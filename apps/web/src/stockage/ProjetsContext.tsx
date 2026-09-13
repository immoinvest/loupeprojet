import { ProjetSchema, type ProjetEntree } from '@loupe/moteur';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import {
  creerProjet,
  ecrireProjets,
  lireProjets,
  type OptionsCreation,
  type ProjetEnregistre,
  type StatutProjet,
} from './projets';

export interface ContexteProjets {
  readonly projets: readonly ProjetEnregistre[];
  readonly creer: (options?: OptionsCreation) => ProjetEnregistre;
  readonly supprimer: (id: string) => void;
  readonly changerStatut: (id: string, statut: StatutProjet) => void;
  readonly trouver: (id: string | undefined) => ProjetEnregistre | undefined;
  /** Remplace le projet après validation Zod ; une entrée invalide n'est pas enregistrée. */
  readonly mettreAJour: (id: string, projet: ProjetEntree) => MiseAJour;
}

export type MiseAJour =
  | { readonly ok: true }
  | { readonly ok: false; readonly erreurs: Readonly<Record<string, string>> };

const Contexte = createContext<ContexteProjets | null>(null);

export interface ProjetsProviderProps {
  readonly stockage?: Storage | undefined;
  readonly children: ReactNode;
}

/** Au premier lancement, la liste vide est amorcée avec le projet d'exemple. */
function chargerOuAmorcer(stockage: Storage): ProjetEnregistre[] {
  const existants = lireProjets(stockage);
  if (existants.length > 0) return existants;
  const exemple = creerProjet({ nom: 'T3 · 65 m² · Marseille 5e', statut: 'visite' });
  ecrireProjets(stockage, [exemple]);
  return [exemple];
}

export function ProjetsProvider({ stockage, children }: ProjetsProviderProps): ReactNode {
  const store = stockage ?? window.localStorage;
  const [projets, setProjets] = useState<readonly ProjetEnregistre[]>(() =>
    chargerOuAmorcer(store),
  );

  const remplacer = useCallback(
    (suivants: readonly ProjetEnregistre[]): void => {
      ecrireProjets(store, suivants);
      setProjets(suivants);
    },
    [store],
  );

  const valeur = useMemo<ContexteProjets>(
    () => ({
      projets,
      creer: (options) => {
        const nouveau = creerProjet(options);
        remplacer([nouveau, ...projets]);
        return nouveau;
      },
      supprimer: (id) => {
        remplacer(projets.filter((p) => p.id !== id));
      },
      changerStatut: (id, statut) => {
        remplacer(
          projets.map((p) =>
            p.id === id ? { ...p, statut, modifieLe: new Date().toISOString() } : p,
          ),
        );
      },
      trouver: (id) => projets.find((p) => p.id === id),
      mettreAJour: (id, projet) => {
        const resultat = ProjetSchema.safeParse(projet);
        if (!resultat.success) {
          const erreurs: Record<string, string> = {};
          for (const issue of resultat.error.issues) {
            erreurs[issue.path.map(String).join('.')] = issue.message;
          }
          return { ok: false, erreurs };
        }
        remplacer(
          projets.map((p) =>
            p.id === id ? { ...p, projet: resultat.data, modifieLe: new Date().toISOString() } : p,
          ),
        );
        return { ok: true };
      },
    }),
    [projets, remplacer],
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useProjets(): ContexteProjets {
  const contexte = useContext(Contexte);
  if (contexte === null) {
    throw new Error('useProjets doit être utilisé sous ProjetsProvider');
  }
  return contexte;
}
