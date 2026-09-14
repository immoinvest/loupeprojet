import type { Handler } from 'hono';
import type { BlankEnv } from 'hono/types';
import { z } from 'zod';

import type { Dependances } from '../dependances';
import { lireJsonValide, nouvellePasse, type Passe } from '../donnees/passe';
import { reponseErreur } from '../erreurs';
import { ecrireCache, lireCache, repondre } from '../http';
import { cleCache } from '../proxy/cache';
import { assemblerMarche, type ParametresMarche } from './assembler';
import {
  CommunesSchema,
  CourantSchema,
  departementDe,
  IndexDvfSchema,
  LoyersSchema,
  TypeLogementSchema,
  ZonageSchema,
  type IndexDvf,
  type Loyers,
} from './fichiers';
import { millesimesDvfAEssayer } from './millesime';

/** Les référentiels changent au mieux une fois par mois : une réponse vaut 24 heures. */
export const TTL_MARCHE_SECONDES = 24 * 3600;
/** À incrémenter quand le contrat de réponse change : les réponses en cache en dépendent. */
const VERSION_CONTRAT = 2;

export const ParametresMarcheSchema = z.object({
  codeInsee: z.string().regex(/^(\d{5}|2[AB]\d{3})$/),
  codePostal: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
  type: TypeLogementSchema.default('appartement'),
  pieces: z.coerce.number().int().min(1).max(30).optional(),
});

async function lireDvf(passe: Passe, departement: string): Promise<IndexDvf | null> {
  for (const millesime of await millesimesDvfAEssayer(passe)) {
    const index = await lireJsonValide(
      passe,
      `dvf/${millesime}/index/${departement}.json`,
      IndexDvfSchema,
    );
    if (index !== null) return index;
  }
  return null;
}

async function lireLoyers(passe: Passe, departement: string): Promise<Loyers | null> {
  const courant = await lireJsonValide(passe, 'loyers/courant.json', CourantSchema);
  return courant === null
    ? null
    : lireJsonValide(passe, `loyers/${courant.millesime}/${departement}.json`, LoyersSchema);
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
    const passe = nouvellePasse(deps);
    const [communes, dvf, loyers, zonage] = await Promise.all([
      lireJsonValide(passe, `communes/${departement}.json`, CommunesSchema),
      lireDvf(passe, departement),
      lireLoyers(passe, departement),
      lireJsonValide(passe, `zonage/${departement}.json`, ZonageSchema),
    ]);
    const reponse = assemblerMarche(
      parametres,
      departement,
      { communes, dvf, loyers, zonage },
      deps.maintenant(),
    );
    const texte = JSON.stringify({
      ...reponse,
      obtenuLe: new Date(deps.maintenant()).toISOString(),
    });
    if (!passe.panne) await ecrireCache(deps, cle, texte, TTL_MARCHE_SECONDES);
    return repondre(c, texte, 'MISS');
  };
}
