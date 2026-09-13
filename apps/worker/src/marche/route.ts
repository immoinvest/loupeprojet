import type { Handler } from 'hono';
import type { BlankEnv } from 'hono/types';
import { z } from 'zod';

import type { Dependances } from '../dependances';
import { messageDe, reponseErreur } from '../erreurs';
import { ecrireCache, lireCache, repondre } from '../http';
import { cleCache } from '../proxy/cache';
import { assemblerMarche, type ParametresMarche } from './assembler';
import {
  CommunesSchema,
  CourantSchema,
  departementDe,
  IndexDvfSchema,
  LoyersSchema,
  millesimesDvfCandidats,
  TypeLogementSchema,
  ZonageSchema,
  type IndexDvf,
  type Loyers,
} from './fichiers';

/** Les référentiels changent au mieux une fois par mois : une réponse vaut 24 heures. */
export const TTL_MARCHE_SECONDES = 24 * 3600;
/** À incrémenter quand le contrat de réponse change : les réponses en cache en dépendent. */
const VERSION_CONTRAT = 1;

export const ParametresMarcheSchema = z.object({
  codeInsee: z.string().regex(/^(\d{5}|2[AB]\d{3})$/),
  codePostal: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
  type: TypeLogementSchema.default('appartement'),
  pieces: z.coerce.number().int().min(1).max(30).optional(),
});

/** Une passe de lecture : note si un fichier n'a pas pu être lu (on ne met pas alors la réponse en cache). */
interface Passe {
  readonly deps: Dependances;
  panne: boolean;
}

async function lire<T>(passe: Passe, cle: string, schema: z.ZodType<T>): Promise<T | null> {
  let brut: unknown;
  try {
    brut = await passe.deps.donnees.lireJson(cle);
  } catch (erreur) {
    passe.panne = true;
    passe.deps.journal.erreur('donnees.lecture_impossible', { cle, raison: messageDe(erreur) });
    return null;
  }
  if (brut === null) return null;
  const lecture = schema.safeParse(brut);
  if (!lecture.success) {
    passe.deps.journal.erreur('donnees.invalides', { cle });
    return null;
  }
  return lecture.data;
}

/** `dvf/courant.json` n'existe qu'après une passe France entière : sinon, on essaie les derniers millésimes. */
async function lireDvf(passe: Passe, departement: string): Promise<IndexDvf | null> {
  const courant = await lire(passe, 'dvf/courant.json', CourantSchema);
  const millesimes =
    courant === null ? millesimesDvfCandidats(passe.deps.maintenant()) : [courant.millesime];
  for (const millesime of millesimes) {
    const index = await lire(passe, `dvf/${millesime}/index/${departement}.json`, IndexDvfSchema);
    if (index !== null) return index;
  }
  return null;
}

async function lireLoyers(passe: Passe, departement: string): Promise<Loyers | null> {
  const courant = await lire(passe, 'loyers/courant.json', CourantSchema);
  return courant === null
    ? null
    : lire(passe, `loyers/${courant.millesime}/${departement}.json`, LoyersSchema);
}

/**
 * GET /marche?codeInsee=…&codePostal=…&type=…&pieces=… : prix au m² des ventes réelles (DVF),
 * loyer d'annonce (ANIL) et zone ABC d'une commune, lus dans les référentiels publiés sur R2.
 */
export function creerMarche(deps: Dependances): Handler<BlankEnv, '/marche'> {
  return async (c) => {
    const lecture = ParametresMarcheSchema.safeParse(c.req.query());
    if (!lecture.success) {
      const champs = [...new Set(lecture.error.issues.map((i) => i.path.map(String).join('.')))];
      return reponseErreur(400, 'PARAMETRES_INVALIDES', { champs });
    }
    const parametres: ParametresMarche = lecture.data;
    const cle = await cleCache('marche', { version: VERSION_CONTRAT, ...parametres });
    const enCache = await lireCache(deps, cle);
    if (enCache !== null) return repondre(c, enCache, 'HIT');

    const departement = departementDe(parametres.codeInsee);
    const passe: Passe = { deps, panne: false };
    const [communes, dvf, loyers, zonage] = await Promise.all([
      lire(passe, `communes/${departement}.json`, CommunesSchema),
      lireDvf(passe, departement),
      lireLoyers(passe, departement),
      lire(passe, `zonage/${departement}.json`, ZonageSchema),
    ]);
    const reponse = assemblerMarche(parametres, departement, { communes, dvf, loyers, zonage });
    const texte = JSON.stringify({
      ...reponse,
      obtenuLe: new Date(deps.maintenant()).toISOString(),
    });
    if (!passe.panne) await ecrireCache(deps, cle, texte, TTL_MARCHE_SECONDES);
    return repondre(c, texte, 'MISS');
  };
}
