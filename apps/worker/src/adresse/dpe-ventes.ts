import { z } from 'zod';

import type { Dependances } from '../dependances';
import { messageDe } from '../erreurs';
import { ecrireCache, lireCache } from '../http';
import { cleCache } from '../proxy/cache';
import { URL_ADEME } from '../services/dpe';
import type { VenteDvf } from './ventes';

/** Adresses par requête ADEME (`identifiant_ban_in`) : l'URL reste courte. */
export const TAILLE_PAQUET_DPE = 50;
/** Les sous-requêtes d'un Worker sont comptées : 4 paquets au plus, les adresses les plus proches d'abord. */
export const MAX_PAQUETS_DPE = 4;
/** DPE rendus par paquet : une grande résidence en compte plusieurs centaines. */
export const MAX_DPE_PAR_PAQUET = 2000;
/** Surface habitable du DPE à ±10 % de la surface vendue. */
export const TOLERANCE_SURFACE_DPE_VENTE = 0.1;
/** Le DPE est obligatoire à la vente : on le cherche dans les 18 mois qui la précèdent. */
export const FENETRE_DPE_MOIS = 18;
/** Comme `/proxy/dpe` : 7 jours. */
export const TTL_DPE_VENTES_SECONDES = 7 * 24 * 3600;
const DELAI_ADEME_MS = 8000;

const CHAMPS = [
  'identifiant_ban',
  'date_etablissement_dpe',
  'etiquette_dpe',
  'etiquette_ges',
  'surface_habitable_logement',
  'conso_5_usages_par_m2_ep',
  'periode_construction',
  'type_energie_principale_chauffage',
] as const;

const LETTRES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
const LettreSchema = z.enum(LETTRES);
type Lettre = z.infer<typeof LettreSchema>;

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

const texte = z.string().nullish();
const nombre = z.number().nullish();

const ReponseAdemeSchema = z.object({
  results: z.array(
    z.object({
      identifiant_ban: texte,
      date_etablissement_dpe: texte,
      etiquette_dpe: texte,
      etiquette_ges: texte,
      surface_habitable_logement: nombre,
      conso_5_usages_par_m2_ep: nombre,
      periode_construction: texte,
      type_energie_principale_chauffage: texte,
    }),
  ),
});
export type ReponseAdemeVentes = z.infer<typeof ReponseAdemeSchema>;

/** Le DPE probable d'un logement vendu : c'est un rapprochement par l'adresse, pas un lien officiel. */
export interface DpeVente {
  readonly etiquetteDpe: Lettre;
  readonly etiquetteGes: Lettre | null;
  /** Consommation d'énergie primaire, cinq usages, en kWh/m²/an. */
  readonly consommationM2: number | null;
  /** « 1948-1974 », « 2013-2021 »… tel que la base l'écrit. */
  readonly periodeConstruction: string | null;
  /** « Gaz naturel », « Électricité »… */
  readonly energieChauffage: string | null;
  readonly date: string;
  readonly surface: number;
}

const DpeCandidatSchema = z.object({
  cleBan: z.string(),
  etiquetteDpe: LettreSchema,
  etiquetteGes: LettreSchema.nullable(),
  consommationM2: z.number().nullable(),
  periodeConstruction: z.string().nullable(),
  energieChauffage: z.string().nullable(),
  date: z.string(),
  surface: z.number(),
});
/** Un DPE de la base ADEME, avec la clé BAN de son adresse en minuscules. */
export type DpeCandidat = z.infer<typeof DpeCandidatSchema>;

function lettreDe(valeur: string | null | undefined): Lettre | null {
  return LETTRES.find((l) => l === valeur) ?? null;
}

function libre(valeur: string | null | undefined): string | null {
  const nettoye = (valeur ?? '').trim();
  return nettoye === '' ? null : nettoye;
}

/**
 * Numéros fictifs de la DGFiP (9001, 9002…) : adressage fiscal des résidences et cités sans numéro de voirie,
 * absent de la BAN, donc des DPE.
 */
export const NUMERO_FISCAL_MIN = 9000;

/**
 * Clé BAN d'une vente, au format des DPE : `13205_6659_00144` (commune, voie en minuscules, numéro sur cinq
 * chiffres). `null` sans voie, sans numéro ou avec un numéro fiscal. Les suffixes (bis, ter) ne sont pas rapprochés.
 */
export function cleBanVente(
  vente: Pick<VenteDvf, 'codeInsee' | 'codeVoie' | 'numero'>,
  codeInseeBien: string,
): string | null {
  if (vente.codeVoie === null || vente.numero === null || vente.numero >= NUMERO_FISCAL_MIN) {
    return null;
  }
  const commune = vente.codeInsee ?? codeInseeBien;
  return `${commune}_${vente.codeVoie.toLowerCase()}_${String(vente.numero).padStart(5, '0')}`;
}

/** `2025-03-01` moins 18 mois → `2023-09-01`. */
export function moisAvant(dateIso: string, mois: number): string {
  const date = new Date(`${dateIso}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - mois);
  return date.toISOString().slice(0, 10);
}

/** DPE lisibles de la réponse ADEME : étiquette, adresse BAN, date et surface habitable connues. */
export function candidatsDepuisAdeme(amont: ReponseAdemeVentes): DpeCandidat[] {
  return amont.results.flatMap((l): DpeCandidat[] => {
    const etiquette = lettreDe(l.etiquette_dpe);
    const cleBan = (l.identifiant_ban ?? '').trim().toLowerCase();
    const date = (l.date_etablissement_dpe ?? '').slice(0, 10);
    const surface = l.surface_habitable_logement ?? 0;
    if (etiquette === null || cleBan === '' || !DATE_ISO.test(date) || !(surface > 0)) return [];
    const consommation = l.conso_5_usages_par_m2_ep;
    return [
      {
        cleBan,
        etiquetteDpe: etiquette,
        etiquetteGes: lettreDe(l.etiquette_ges),
        consommationM2: consommation == null ? null : Math.round(consommation),
        periodeConstruction: libre(l.periode_construction),
        energieChauffage: libre(l.type_energie_principale_chauffage),
        date,
        surface,
      },
    ];
  });
}

/**
 * Le DPE probable d'une vente parmi ceux de son adresse : surface à ±10 %, établi dans les 18 mois avant la
 * vente ; le plus proche en surface, puis en date. `null` sans candidat. Pure.
 */
export function rapprocherDpe(
  vente: { readonly date: string; readonly surface: number },
  candidats: readonly DpeCandidat[],
): DpeVente | null {
  const debut = moisAvant(vente.date, FENETRE_DPE_MOIS);
  const ecartSurface = (c: DpeCandidat): number => Math.abs(c.surface - vente.surface);
  const ecartJours = (c: DpeCandidat): number =>
    Math.abs(Date.parse(vente.date) - Date.parse(c.date));
  const [meilleur] = candidats
    .filter(
      (c) =>
        c.date >= debut &&
        c.date <= vente.date &&
        ecartSurface(c) <= vente.surface * TOLERANCE_SURFACE_DPE_VENTE,
    )
    .sort((a, b) => ecartSurface(a) - ecartSurface(b) || ecartJours(a) - ecartJours(b));
  if (meilleur === undefined) return null;
  return {
    etiquetteDpe: meilleur.etiquetteDpe,
    etiquetteGes: meilleur.etiquetteGes,
    consommationM2: meilleur.consommationM2,
    periodeConstruction: meilleur.periodeConstruction,
    energieChauffage: meilleur.energieChauffage,
    date: meilleur.date,
    surface: meilleur.surface,
  };
}

/** Un paquet d'adresses : du cache, sinon de la base ADEME ; `null` quand la base ne répond pas correctement. */
async function lirePaquet(
  deps: Dependances,
  cles: readonly string[],
): Promise<readonly DpeCandidat[] | null> {
  const cle = await cleCache('dpe-ventes', { version: 1, cles: [...cles].sort() });
  const enCache = await lireCache(deps, cle);
  if (enCache !== null) {
    const lecture = z.array(DpeCandidatSchema).safeParse(JSON.parse(enCache));
    if (lecture.success) return lecture.data;
  }
  const url = new URL(URL_ADEME);
  url.searchParams.set('identifiant_ban_in', cles.join(','));
  url.searchParams.set('size', String(MAX_DPE_PAR_PAQUET));
  url.searchParams.set('select', CHAMPS.join(','));
  let corps: unknown;
  try {
    const reponse = await deps.fetcher(url, {
      signal: AbortSignal.timeout(DELAI_ADEME_MS),
      headers: { accept: 'application/json' },
    });
    if (!reponse.ok) {
      deps.journal.erreur('dpe_ventes.erreur', { statutAmont: reponse.status });
      return null;
    }
    corps = await reponse.json();
  } catch (erreur) {
    deps.journal.erreur('dpe_ventes.injoignable', { raison: messageDe(erreur) });
    return null;
  }
  const lecture = ReponseAdemeSchema.safeParse(corps);
  if (!lecture.success) {
    deps.journal.erreur('dpe_ventes.invalide', {});
    return null;
  }
  const candidats = candidatsDepuisAdeme(lecture.data);
  await ecrireCache(deps, cle, JSON.stringify(candidats), TTL_DPE_VENTES_SECONDES);
  return candidats;
}

export interface DpeDesVentes {
  readonly parCle: ReadonlyMap<string, readonly DpeCandidat[]>;
  /** Faux quand un paquet n'a pas pu être lu : l'analyse n'est alors pas mise en cache. */
  readonly complet: boolean;
}

/**
 * Les DPE des adresses données (les plus proches d'abord), par paquets de 50 en parallèle, 4 paquets au plus :
 * une requête ADEME par paquet, jamais une par vente.
 */
export async function lireDpeVentes(
  deps: Dependances,
  cles: readonly string[],
): Promise<DpeDesVentes> {
  const uniques = [...new Set(cles)].slice(0, TAILLE_PAQUET_DPE * MAX_PAQUETS_DPE);
  const paquets = Array.from({ length: Math.ceil(uniques.length / TAILLE_PAQUET_DPE) }, (_, i) =>
    uniques.slice(i * TAILLE_PAQUET_DPE, (i + 1) * TAILLE_PAQUET_DPE),
  );
  const lus = await Promise.all(paquets.map((p) => lirePaquet(deps, p)));
  const parCle = new Map<string, DpeCandidat[]>();
  for (const candidat of lus.flatMap((l) => l ?? [])) {
    parCle.set(candidat.cleBan, [...(parCle.get(candidat.cleBan) ?? []), candidat]);
  }
  return { parCle, complet: lus.every((l) => l !== null) };
}

/** Ajoute à chaque vente son DPE probable. */
export function avecDpe<
  V extends { readonly cleBan: string | null; readonly date: string; readonly surface: number },
>(ventes: readonly V[], dpe: DpeDesVentes): (V & { readonly dpe: DpeVente | null })[] {
  return ventes.map((v) => ({
    ...v,
    dpe: v.cleBan === null ? null : rapprocherDpe(v, dpe.parCle.get(v.cleBan) ?? []),
  }));
}
