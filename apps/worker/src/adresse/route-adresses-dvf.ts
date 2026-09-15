import type { Handler } from 'hono';
import type { BlankEnv } from 'hono/types';
import { z } from 'zod';

import type { Dependances } from '../dependances';
import { nouvellePasse } from '../donnees/passe';
import { reponseErreur } from '../erreurs';
import { ecrireCache, lireCache, repondre } from '../http';
import { cleCache } from '../proxy/cache';
import { filtrerAdresses, lireRecherche, regrouperAdresses, type AdresseDvf } from './adresses-dvf';
import { SOURCE_DVF, ventesCommune } from './route';

/** La liste des adresses d'une commune vaut 24 heures : une écriture par commune, jamais par frappe. */
export const TTL_ADRESSES_DVF_SECONDES = 24 * 3600;
/** À incrémenter quand la forme de la liste en cache change. */
const VERSION_LISTE = 1;
export const LIMITE_ADRESSES_DVF = 6;

export const ParametresAdressesDvfSchema = z.object({
  codeInsee: z.string().regex(/^(\d{5}|2[AB]\d{3})$/),
  texte: z.string().trim().min(3).max(200),
  limit: z.coerce.number().int().min(1).max(10).default(LIMITE_ADRESSES_DVF),
});

const AdresseDvfSchema = z.object({
  libelle: z.string(),
  numero: z.number(),
  suffixe: z.string().nullable(),
  codeVoie: z.string(),
  voie: z.string(),
  parcelles: z.array(z.string()),
  lat: z.number(),
  lon: z.number(),
  ventes: z.number(),
});

const ListeSchema = z.object({
  millesime: z.string().nullable(),
  adresses: z.array(AdresseDvfSchema),
});

interface Liste {
  readonly millesime: string | null;
  readonly adresses: readonly AdresseDvf[];
}

async function listeDepuisR2(deps: Dependances, cle: string, codeInsee: string): Promise<Liste> {
  const passe = nouvellePasse(deps);
  const commune = await ventesCommune(passe, codeInsee);
  const liste: Liste = {
    millesime: commune?.millesime ?? null,
    adresses: regrouperAdresses(commune?.ventes ?? []),
  };
  if (!passe.panne) {
    await ecrireCache(deps, cle, JSON.stringify(liste), TTL_ADRESSES_DVF_SECONDES);
  }
  return liste;
}

async function listeEnCache(deps: Dependances, cle: string): Promise<Liste | null> {
  const texte = await lireCache(deps, cle);
  if (texte === null) return null;
  try {
    const lecture = ListeSchema.safeParse(JSON.parse(texte));
    return lecture.success ? lecture.data : null;
  } catch {
    return null;
  }
}

/**
 * GET /marche/adresses-dvf?codeInsee&texte&limit : les adresses du cadastre (ventes DVF) d'une commune qui
 * répondent au texte tapé. Sert les adresses fiscales absentes de la BAN (« 9001 Cité Valcros »).
 */
export function creerAdressesDvf(deps: Dependances): Handler<BlankEnv, '/marche/adresses-dvf'> {
  return async (c) => {
    const lecture = ParametresAdressesDvfSchema.safeParse(c.req.query());
    if (!lecture.success) {
      const champs = [...new Set(lecture.error.issues.map((i) => i.path.map(String).join('.')))];
      return reponseErreur(400, 'PARAMETRES_INVALIDES', { champs });
    }
    const p = lecture.data;
    const cle = await cleCache('adresses-dvf', { version: VERSION_LISTE, codeInsee: p.codeInsee });
    const enCache = await listeEnCache(deps, cle);
    const origine = enCache === null ? 'MISS' : 'HIT';
    const liste = enCache ?? (await listeDepuisR2(deps, cle, p.codeInsee));
    const adresses = filtrerAdresses(liste.adresses, lireRecherche(p.texte), p.limit);
    return repondre(
      c,
      JSON.stringify({
        codeInsee: p.codeInsee,
        millesime: liste.millesime,
        adresses,
        sources: liste.millesime === null ? [] : [SOURCE_DVF],
      }),
      origine,
    );
  };
}
