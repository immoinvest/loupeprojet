import {
  DEPENSES_MAX,
  NouvelleDepenseSchema,
  PretBienSchema,
  type Depense,
  type EtatArgent,
} from '@loupe/gestion';

import type { ClientArgent, CodeErreurArgent, ResultatArgent } from './types';

export type ActionArgent = keyof ClientArgent;

export interface OptionsArgentMemoire {
  readonly etat?: EtatArgent;
  /** Force une erreur sur une action, pour vérifier son affichage. */
  readonly erreurs?: Partial<Record<ActionArgent, CodeErreurArgent>>;
  /** Horodatage des écritures. */
  readonly maintenant?: string;
  /** Nombre maximal de dépenses (2 000 par défaut, comme l'API). */
  readonly limite?: number;
}

export interface ClientArgentMemoire extends ClientArgent {
  readonly donnees: () => EtatArgent;
  readonly appels: ActionArgent[];
}

export const ETAT_ARGENT_VIDE: EtatArgent = { depenses: [], prets: [] };

const INVALIDE = { ok: false, code: 'invalide' } as const;
const INTROUVABLE = { ok: false, code: 'introuvable' } as const;

/**
 * Un client sans réseau, aux règles de l'API (schémas, limite, introuvable) : tests et aperçu. Il ne
 * connaît pas les biens du compte : le contrôle « bien d'un autre compte » reste à l'API.
 */
export function clientArgentMemoire(options: OptionsArgentMemoire = {}): ClientArgentMemoire {
  let donnees = options.etat ?? ETAT_ARGENT_VIDE;
  const maintenant = options.maintenant ?? '2026-09-14T09:00:00.000Z';
  const limite = options.limite ?? DEPENSES_MAX;
  const appels: ActionArgent[] = [];
  let compteur = 0;

  function executer<T>(
    action: ActionArgent,
    faire: () => ResultatArgent<T>,
  ): Promise<ResultatArgent<T>> {
    appels.push(action);
    const erreur = options.erreurs?.[action];
    return Promise.resolve(erreur === undefined ? faire() : { ok: false, code: erreur });
  }

  return {
    appels,
    donnees: () => donnees,
    etat: () => executer('etat', () => ({ ok: true, valeur: donnees })),
    ajouterDepense: (nouvelle) =>
      executer('ajouterDepense', () => {
        const lu = NouvelleDepenseSchema.safeParse(nouvelle);
        if (!lu.success) return INVALIDE;
        if (donnees.depenses.length >= limite) return { ok: false, code: 'limite' };
        compteur += 1;
        const depense: Depense = {
          id: `depense-${String(compteur)}`,
          ...lu.data,
          creeLe: maintenant,
          modifieLe: maintenant,
        };
        donnees = { ...donnees, depenses: [...donnees.depenses, depense] };
        return { ok: true, valeur: depense };
      }),
    modifierDepense: (id, modifiee) =>
      executer('modifierDepense', () => {
        const lu = NouvelleDepenseSchema.safeParse(modifiee);
        if (!lu.success) return INVALIDE;
        const avant = donnees.depenses.find((d) => d.id === id);
        if (avant === undefined) return INTROUVABLE;
        const depense: Depense = { id, ...lu.data, creeLe: avant.creeLe, modifieLe: maintenant };
        donnees = {
          ...donnees,
          depenses: donnees.depenses.map((d) => (d.id === id ? depense : d)),
        };
        return { ok: true, valeur: depense };
      }),
    supprimerDepense: (id) =>
      executer('supprimerDepense', () => {
        if (!donnees.depenses.some((d) => d.id === id)) return INTROUVABLE;
        donnees = { ...donnees, depenses: donnees.depenses.filter((d) => d.id !== id) };
        return { ok: true, valeur: undefined };
      }),
    enregistrerPret: (bienId, pret) =>
      executer('enregistrerPret', () => {
        const lu = PretBienSchema.safeParse(pret);
        if (!lu.success) return INVALIDE;
        const enregistre = { ...lu.data, bienId, modifieLe: maintenant };
        donnees = {
          ...donnees,
          prets: [...donnees.prets.filter((p) => p.bienId !== bienId), enregistre],
        };
        return { ok: true, valeur: enregistre };
      }),
    supprimerPret: (bienId) =>
      executer('supprimerPret', () => {
        if (!donnees.prets.some((p) => p.bienId === bienId)) return INTROUVABLE;
        donnees = { ...donnees, prets: donnees.prets.filter((p) => p.bienId !== bienId) };
        return { ok: true, valeur: undefined };
      }),
  };
}
