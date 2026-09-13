import type { z } from 'zod';

import { ErreurAmontInvalide } from '../erreurs';

export type LectureParametres =
  | { readonly ok: true; readonly parametres: Readonly<Record<string, unknown>>; readonly url: URL }
  | { readonly ok: false; readonly champs: readonly string[] };

/** Un service amont proxifié : paramètres autorisés, URL amont, contrat de réponse Loupe. */
export interface Service {
  readonly nom: string;
  readonly ttlSecondes: number;
  readonly delaiMs: number;
  lireParametres(brut: Readonly<Record<string, string>>): LectureParametres;
  /** Transforme la réponse amont en réponse Loupe ; lève ErreurAmontInvalide si elle ne correspond pas. */
  normaliser(amont: unknown): unknown;
}

/** Ferme les types d'une définition : le proxy manipule tous les services de la même façon. */
export function definirService<P extends Record<string, unknown>, A>(definition: {
  readonly nom: string;
  readonly ttlSecondes: number;
  readonly delaiMs: number;
  readonly parametres: z.ZodType<P>;
  readonly urlAmont: (parametres: P) => URL;
  readonly reponseAmont: z.ZodType<A>;
  readonly normaliser: (amont: A) => unknown;
}): Service {
  return {
    nom: definition.nom,
    ttlSecondes: definition.ttlSecondes,
    delaiMs: definition.delaiMs,
    lireParametres(brut) {
      const lecture = definition.parametres.safeParse(brut);
      if (!lecture.success) {
        // L'entrée est toujours un objet : chaque problème porte le nom de son champ.
        const champs = lecture.error.issues.map((i) => i.path.map(String).join('.'));
        return { ok: false, champs: [...new Set(champs)] };
      }
      return { ok: true, parametres: lecture.data, url: definition.urlAmont(lecture.data) };
    },
    normaliser(amont) {
      const lecture = definition.reponseAmont.safeParse(amont);
      if (!lecture.success) {
        throw new ErreurAmontInvalide(
          `${definition.nom} : ${lecture.error.issues.map((i) => i.path.map(String).join('.') || 'racine').join(', ')}`,
        );
      }
      return definition.normaliser(lecture.data);
    },
  };
}
