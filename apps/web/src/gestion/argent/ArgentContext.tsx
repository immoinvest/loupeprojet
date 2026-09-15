import type {
  Depense,
  EtatArgent,
  NouvelleDepense,
  PretBien,
  PretEnregistre,
} from '@loupe/gestion';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useCompte } from '@/compte/CompteContext';

import type { ClientArgent, CodeErreurArgent, ResultatArgent } from './types';

/**
 * `anonyme` : pas de compte ; `chargement` ; `pret` ; `indisponible` : la migration 0007 manque
 * (seules les pages Argent le disent) ; `erreur` : autre panne.
 */
export type StatutArgent = 'anonyme' | 'chargement' | 'pret' | 'indisponible' | 'erreur';

export interface ContexteArgent {
  readonly statut: StatutArgent;
  /** Dépenses et prêts du compte, seulement quand `statut` vaut `pret`. */
  readonly donnees: EtatArgent | null;
  readonly erreur: CodeErreurArgent | null;
  readonly recharger: () => void;
  readonly ajouterDepense: (depense: NouvelleDepense) => Promise<ResultatArgent<Depense>>;
  readonly modifierDepense: (
    id: string,
    depense: NouvelleDepense,
  ) => Promise<ResultatArgent<Depense>>;
  readonly supprimerDepense: (id: string) => Promise<ResultatArgent>;
  readonly enregistrerPret: (
    bienId: string,
    pret: PretBien,
  ) => Promise<ResultatArgent<PretEnregistre>>;
  readonly supprimerPret: (bienId: string) => Promise<ResultatArgent>;
}

const Contexte = createContext<ContexteArgent | null>(null);

type Chargement = 'chargement' | 'pret' | 'erreur';

/** Dépenses et prêts lus quand le compte est connecté, à part de l'état de Gérer (ADR-G25). */
export function ArgentProvider({
  client,
  children,
}: {
  client: ClientArgent;
  children: ReactNode;
}): ReactNode {
  const { etat: etatCompte } = useCompte();
  const [chargement, setChargement] = useState<Chargement>('chargement');
  const [donnees, setDonnees] = useState<EtatArgent | null>(null);
  const [erreur, setErreur] = useState<CodeErreurArgent | null>(null);
  const [version, setVersion] = useState(0);
  const connecte = etatCompte === 'connecte';

  useEffect(() => {
    if (!connecte) return;
    setChargement('chargement');
    void client.etat().then((r) => {
      if (!r.ok) {
        setErreur(r.code);
        setChargement('erreur');
        return;
      }
      setDonnees(r.valeur);
      setErreur(null);
      setChargement('pret');
    });
  }, [client, connecte, version]);

  const valeur = useMemo<ContexteArgent>(() => {
    const statut: StatutArgent =
      etatCompte !== 'connecte'
        ? etatCompte
        : chargement === 'erreur' && erreur === 'indisponible'
          ? 'indisponible'
          : chargement;
    /** Applique le changement à l'état chargé quand l'action a réussi ; rend le résultat tel quel. */
    function apres<T>(
      r: ResultatArgent<T>,
      changer: (valeur: T, e: EtatArgent) => EtatArgent,
    ): ResultatArgent<T> {
      if (r.ok) setDonnees((e) => (e === null ? e : changer(r.valeur, e)));
      return r;
    }

    return {
      statut,
      donnees: statut === 'pret' ? donnees : null,
      erreur: statut === 'erreur' || statut === 'indisponible' ? erreur : null,
      recharger: () => {
        setVersion((v) => v + 1);
      },
      ajouterDepense: async (nouvelle) =>
        apres(await client.ajouterDepense(nouvelle), (depense, e) => ({
          ...e,
          depenses: [...e.depenses, depense],
        })),
      modifierDepense: async (id, modifiee) =>
        apres(await client.modifierDepense(id, modifiee), (depense, e) => ({
          ...e,
          depenses: e.depenses.map((d) => (d.id === id ? depense : d)),
        })),
      supprimerDepense: async (id) =>
        apres(await client.supprimerDepense(id), (_, e) => ({
          ...e,
          depenses: e.depenses.filter((d) => d.id !== id),
        })),
      enregistrerPret: async (bienId, pret) =>
        apres(await client.enregistrerPret(bienId, pret), (enregistre, e) => ({
          ...e,
          prets: [...e.prets.filter((p) => p.bienId !== bienId), enregistre],
        })),
      supprimerPret: async (bienId) =>
        apres(await client.supprimerPret(bienId), (_, e) => ({
          ...e,
          prets: e.prets.filter((p) => p.bienId !== bienId),
        })),
    };
  }, [client, etatCompte, chargement, donnees, erreur]);

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useArgent(): ContexteArgent {
  const contexte = useContext(Contexte);
  if (contexte === null) {
    throw new Error('useArgent doit être utilisé sous ArgentProvider');
  }
  return contexte;
}
