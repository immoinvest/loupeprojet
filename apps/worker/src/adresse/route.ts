import type { Handler } from 'hono';
import type { BlankEnv } from 'hono/types';
import { z } from 'zod';

import type { Dependances } from '../dependances';
import { moisEntre } from '../donnees/anciennete';
import { lireTexte, nouvellePasse, type Passe } from '../donnees/passe';
import { reponseErreur } from '../erreurs';
import { ecrireCache, lireCache, repondre } from '../http';
import { TypeLogementSchema, type TypeLogement } from '../marche/fichiers';
import { millesimesDvfAEssayer } from '../marche/millesime';
import { cleCache } from '../proxy/cache';
import { analyserAdresse, type Actualiser } from './analyse';
import { voisinageDe, type Voisinage } from './cadastre';
import {
  coefficientPour,
  lireTendance,
  lisser,
  resumeTendance,
  serieRetenue,
  type ResumeTendance,
} from './tendance';
import { lireVentes, type VenteDvf } from './ventes';
import { communesAutour } from './voisines';

/** Une analyse vaut 24 heures (les ventes changent au mieux chaque semestre). */
export const TTL_ADRESSE_SECONDES = 24 * 3600;
/** Le parcellaire change rarement : 30 jours. */
export const TTL_CADASTRE_SECONDES = 30 * 24 * 3600;
/** À incrémenter quand le contrat de réponse change : les réponses en cache en dépendent. */
// Monter aussi `CONTRAT_ADRESSE` dans apps/web/src/enrichissement/client.ts (cache HTTP du navigateur).
const VERSION_CONTRAT = 6;

export const SOURCE_DVF = {
  nom: 'Demandes de valeurs foncières géolocalisées (Etalab, à partir des données DGFiP)',
  url: 'https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres-geolocalisees',
  licence: 'Licence Ouverte 2.0',
};

export const ParametresAdresseSchema = z.object({
  codeInsee: z.string().regex(/^(\d{5}|2[AB]\d{3})$/),
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  numero: z.coerce.number().int().min(0).max(99_999).optional(),
  /** Code de la voie : la partie centrale de la clé BAN (`13205_6659_00144` → `6659`). */
  codeVoie: z
    .string()
    .regex(/^[0-9A-Za-z]{4}$/)
    .transform((code) => code.toUpperCase())
    .optional(),
  type: TypeLogementSchema.default('appartement'),
  surface: z.coerce.number().positive().max(2000).optional(),
});

const VoisinageSchema = z.object({
  idParcelle: z.string().nullable(),
  voisines: z.array(z.string()),
});

async function voisinageEnCache(
  deps: Dependances,
  lat: number,
  lon: number,
): Promise<Voisinage | null> {
  const cle = await cleCache('cadastre', {
    version: 1,
    lat: Number(lat.toFixed(6)),
    lon: Number(lon.toFixed(6)),
  });
  const enCache = await lireCache(deps, cle);
  if (enCache !== null) {
    const lecture = VoisinageSchema.safeParse(JSON.parse(enCache));
    if (lecture.success) return lecture.data;
  }
  const voisinage = await voisinageDe(deps, { lat, lon });
  if (voisinage !== null) {
    await ecrireCache(deps, cle, JSON.stringify(voisinage), TTL_CADASTRE_SECONDES);
  }
  return voisinage;
}

interface VentesCommune {
  readonly millesime: string;
  readonly ventes: VenteDvf[];
}

async function ventesCommune(passe: Passe, codeInsee: string): Promise<VentesCommune | null> {
  for (const millesime of await millesimesDvfAEssayer(passe)) {
    const texte = await lireTexte(passe, `dvf/${millesime}/${codeInsee}.csv`);
    if (texte !== null) return { millesime, ventes: lireVentes(texte) };
  }
  return null;
}

interface VentesVoisine {
  readonly codeInsee: string;
  readonly ventes: VenteDvf[];
}

/** Ventes d'une commune voisine, marquées de leur code ; `null` quand la commune n'est pas publiée. */
async function ventesVoisine(
  passe: Passe,
  millesime: string,
  codeInsee: string,
): Promise<VentesVoisine | null> {
  const texte = await lireTexte(passe, `dvf/${millesime}/${codeInsee}.csv`);
  return texte === null
    ? null
    : { codeInsee, ventes: lireVentes(texte).map((v) => ({ ...v, codeInsee })) };
}

interface Actualisation {
  readonly coefficient: (date: string) => number;
  readonly resume: ResumeTendance;
}

/** Tendance des prix du millésime lu : série de la commune ou du département, lissée. */
async function actualisation(
  passe: Passe,
  millesime: string,
  codeInsee: string,
  type: TypeLogement,
): Promise<Actualisation | null> {
  const tendance = await lireTendance(passe, millesime, codeInsee);
  const serie = tendance === null ? null : serieRetenue(tendance, codeInsee, type);
  if (serie === null) return null;
  const indices = lisser(serie.points);
  return {
    coefficient: (date) => coefficientPour(indices, date),
    resume: resumeTendance(serie.zone, indices),
  };
}

/**
 * GET /marche/adresse?codeInsee&lat&lon&numero&codeVoie&type&surface : ventes réelles autour d'une adresse
 * précise (même immeuble, parcelles voisines, même côté de la rue, en face, 100 à 300 m, communes voisines
 * comprises), prix ramenés au dernier semestre connu par la tendance de chaque commune, et repère de prix.
 */
export function creerAnalyseAdresse(deps: Dependances): Handler<BlankEnv, '/marche/adresse'> {
  return async (c) => {
    const lecture = ParametresAdresseSchema.safeParse(c.req.query());
    if (!lecture.success) {
      const champs = [...new Set(lecture.error.issues.map((i) => i.path.map(String).join('.')))];
      return reponseErreur(400, 'PARAMETRES_INVALIDES', { champs });
    }
    const p = lecture.data;
    const cle = await cleCache('adresse', { version: VERSION_CONTRAT, ...p });
    const enCache = await lireCache(deps, cle);
    if (enCache !== null) return repondre(c, enCache, 'HIT');

    const passe = nouvellePasse(deps);
    const point = { lat: p.lat, lon: p.lon };
    const [commune, voisinage, autour] = await Promise.all([
      ventesCommune(passe, p.codeInsee),
      voisinageEnCache(deps, p.lat, p.lon),
      communesAutour(deps, point, p.codeInsee),
    ]);
    const voisines =
      commune === null
        ? []
        : (
            await Promise.all(
              autour.codes.map((code) => ventesVoisine(passe, commune.millesime, code)),
            )
          ).filter((v): v is VentesVoisine => v !== null);
    const codes = [p.codeInsee, ...voisines.map((v) => v.codeInsee)];
    const actualisations = new Map(
      commune === null
        ? []
        : await Promise.all(
            codes.map(
              async (code) =>
                [code, await actualisation(passe, commune.millesime, code, p.type)] as const,
            ),
          ),
    );
    const actualiser: Actualiser = (vente) =>
      actualisations.get(vente.codeInsee ?? p.codeInsee)?.coefficient(vente.date) ?? 1;
    const analyse = analyserAdresse(
      [...(commune?.ventes ?? []), ...voisines.flatMap((v) => v.ventes)],
      {
        point,
        numero: p.numero ?? null,
        codeVoie: p.codeVoie ?? null,
        idParcelle: voisinage?.idParcelle ?? null,
        voisines: voisinage?.voisines ?? [],
        type: p.type,
        surface: p.surface,
      },
      actualiser,
    );
    const maintenant = deps.maintenant();
    const texte = JSON.stringify({
      codeInsee: p.codeInsee,
      millesime: commune?.millesime ?? null,
      parcelle: voisinage?.idParcelle ?? null,
      parcellesVoisines: voisinage?.voisines ?? [],
      cadastre: voisinage === null ? 'indisponible' : 'ok',
      ...analyse,
      // Ancienneté mesurée à la date de la réponse (cache de 24 h : au mois près).
      reference:
        analyse.reference === null
          ? null
          : {
              ...analyse.reference,
              ancienneteMedianeMois: moisEntre(analyse.reference.dateMediane, maintenant),
            },
      ventesCommune: commune?.ventes.length ?? 0,
      communesVoisines: voisines.map((v) => ({ codeInsee: v.codeInsee, ventes: v.ventes.length })),
      tendance: actualisations.get(p.codeInsee)?.resume ?? null,
      sources: commune === null ? [] : [SOURCE_DVF],
      obtenuLe: new Date(maintenant).toISOString(),
    });
    if (!passe.panne && voisinage !== null && autour.complet) {
      await ecrireCache(deps, cle, texte, TTL_ADRESSE_SECONDES);
    }
    return repondre(c, texte, 'MISS');
  };
}
