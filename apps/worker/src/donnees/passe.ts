import type { z } from 'zod';

import type { Dependances } from '../dependances';
import { messageDe } from '../erreurs';

/** Une passe de lecture des référentiels : note si un fichier n'a pas pu être lu (la réponse n'est alors pas mise en cache). */
export interface Passe {
  readonly deps: Dependances;
  panne: boolean;
}

export function nouvellePasse(deps: Dependances): Passe {
  return { deps, panne: false };
}

async function essayer<T>(passe: Passe, cle: string, lire: () => Promise<T>): Promise<T | null> {
  try {
    return await lire();
  } catch (erreur) {
    passe.panne = true;
    passe.deps.journal.erreur('donnees.lecture_impossible', { cle, raison: messageDe(erreur) });
    return null;
  }
}

/** Fichier JSON lu et validé ; absent, illisible ou hors contrat → `null` (hors contrat : journalisé). */
export async function lireJsonValide<T>(
  passe: Passe,
  cle: string,
  schema: z.ZodType<T>,
): Promise<T | null> {
  const brut = await essayer(passe, cle, () => passe.deps.donnees.lireJson(cle));
  if (brut === null) return null;
  const lecture = schema.safeParse(brut);
  if (!lecture.success) {
    passe.deps.journal.erreur('donnees.invalides', { cle });
    return null;
  }
  return lecture.data;
}

export function lireTexte(passe: Passe, cle: string): Promise<string | null> {
  return essayer(passe, cle, () => passe.deps.donnees.lireTexte(cle));
}
