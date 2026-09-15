import { ProjetSchema, type Projet, type ProjetEntree } from '@loupe/moteur';
import {
  dateDeModification,
  NOM_EXEMPLE,
  noterEnregistrement,
  noterSuppression,
  type EtatLocal,
  type JournalSynchro,
} from '@loupe/projets';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { ecrireJournal, lireJournal } from './journal';
import { fusionnerTransfert } from './transfert';
import {
  creerProjet,
  ecrireProjets,
  lireProjets,
  type AdresseBien,
  type OptionsCreation,
  type ProjetEnregistre,
  type StatutProjet,
  type Visite,
} from './projets';

/** Ce qui s'enregistre avec le projet sans passer par le moteur : adresse exacte, visite. */
export interface ComplementProjet {
  readonly adresse?: AdresseBien;
  readonly visite?: Visite;
}

export interface ContexteProjets {
  readonly projets: readonly ProjetEnregistre[];
  readonly creer: (options?: OptionsCreation) => ProjetEnregistre;
  readonly supprimer: (id: string) => void;
  readonly changerStatut: (id: string, statut: StatutProjet) => void;
  readonly trouver: (id: string | undefined) => ProjetEnregistre | undefined;
  /** Importe des projets arrivés d'une autre adresse, sans écraser une version plus récente. */
  readonly importer: (recus: readonly ProjetEnregistre[]) => BilanImport;
  /**
   * Remplace le projet après validation Zod ; une entrée invalide n'est pas enregistrée.
   * Le complément (adresse exacte, visite) est enregistré dans la même écriture, pour ne rien écraser.
   */
  readonly mettreAJour: (
    id: string,
    projet: ProjetEntree,
    complement?: ComplementProjet,
  ) => MiseAJour;
}

export interface BilanImport {
  readonly ajoutes: number;
  readonly remplaces: number;
  readonly gardes: number;
}

export type MiseAJour =
  | { readonly ok: true }
  | { readonly ok: false; readonly erreurs: Readonly<Record<string, string>> };

/** Ce dont la synchronisation a besoin : l'état courant, et le transformer sans compter comme une modification. */
export interface StockageProjets {
  /** Les projets et le journal tels qu'ils sont à l'instant (jamais une copie périmée d'un rendu). */
  readonly lire: () => EtatLocal;
  /** Applique une transformation à l'état courant (réponse du compte, changement de compte). */
  readonly transformer: (transformation: (etat: EtatLocal) => EtatLocal) => void;
  /** Augmente à chaque création, modification ou suppression faite sur l'appareil. */
  readonly versionLocale: number;
}

const Contexte = createContext<ContexteProjets | null>(null);
const ContexteStockage = createContext<StockageProjets | null>(null);

export interface ProjetsProviderProps {
  readonly stockage?: Storage | undefined;
  readonly children: ReactNode;
}

/**
 * Au premier lancement, la liste vide est amorcée avec le projet d'exemple ; pas sur un appareil lié à
 * un compte, dont la liste vient du compte.
 */
function chargerOuAmorcer(stockage: Storage, journal: JournalSynchro): ProjetEnregistre[] {
  const existants = lireProjets(stockage);
  if (existants.length > 0 || journal.compte !== null) return existants;
  const exemple = creerProjet({ nom: NOM_EXEMPLE, statut: 'visite' });
  ecrireProjets(stockage, [exemple]);
  return [exemple];
}

function avecProjet(
  etat: EtatLocal,
  id: string,
  changer: (p: ProjetEnregistre) => ProjetEnregistre,
): EtatLocal {
  if (!etat.projets.some((p) => p.id === id)) return etat;
  return {
    projets: etat.projets.map((p) => (p.id === id ? changer(p) : p)),
    journal: noterEnregistrement(etat.journal, id),
  };
}

export function ProjetsProvider({ stockage, children }: ProjetsProviderProps): ReactNode {
  const store = stockage ?? window.localStorage;
  const [initial] = useState<EtatLocal>(() => {
    const journal = lireJournal(store);
    return { projets: chargerOuAmorcer(store, journal), journal };
  });
  const [etat, setEtat] = useState(initial);
  const [versionLocale, setVersionLocale] = useState(0);
  // L'état courant, lu par les actions : deux actions du même clic voient chacune l'effet de la précédente.
  const courant = useRef(initial);

  const ecrire = useCallback(
    (suivant: EtatLocal): boolean => {
      const avant = courant.current;
      if (suivant === avant) return false;
      courant.current = suivant;
      if (suivant.projets !== avant.projets) ecrireProjets(store, suivant.projets);
      if (suivant.journal !== avant.journal) ecrireJournal(store, suivant.journal);
      setEtat(suivant);
      return true;
    },
    [store],
  );

  const modifier = useCallback(
    (transformation: (e: EtatLocal) => EtatLocal): void => {
      if (ecrire(transformation(courant.current))) setVersionLocale((v) => v + 1);
    },
    [ecrire],
  );

  const valeur = useMemo<ContexteProjets>(
    () => ({
      projets: etat.projets,
      creer: (options) => {
        const nouveau = creerProjet(options);
        modifier((e) => ({
          projets: [nouveau, ...e.projets],
          journal: noterEnregistrement(e.journal, nouveau.id),
        }));
        return nouveau;
      },
      supprimer: (id) => {
        modifier((e) => {
          const supprime = e.projets.find((p) => p.id === id);
          if (supprime === undefined) return e;
          // Datée après la dernière modification : le compte ne la prend jamais pour plus ancienne.
          return {
            projets: e.projets.filter((p) => p.id !== id),
            journal: noterSuppression(e.journal, id, dateDeModification(supprime.modifieLe)),
          };
        });
      },
      changerStatut: (id, statut) => {
        modifier((e) =>
          avecProjet(e, id, (p) => ({ ...p, statut, modifieLe: dateDeModification(p.modifieLe) })),
        );
      },
      trouver: (id) => etat.projets.find((p) => p.id === id),
      importer: (recus) => {
        const fusion = fusionnerTransfert(courant.current.projets, recus);
        if (fusion.ecrits.length > 0 || fusion.retires.length > 0) {
          modifier((e) => {
            let journal = e.journal;
            for (const id of fusion.ecrits) journal = noterEnregistrement(journal, id);
            for (const p of fusion.retires) {
              journal = noterSuppression(journal, p.id, dateDeModification(p.modifieLe));
            }
            return { projets: fusion.projets, journal };
          });
        }
        return { ajoutes: fusion.ajoutes, remplaces: fusion.remplaces, gardes: fusion.gardes };
      },
      mettreAJour: (id, projet, complement = {}) => {
        const actuel = courant.current.projets.find((p) => p.id === id)?.projet;
        // Le projet déjà enregistré, inchangé (seul le complément bouge) : rien à revalider, et son
        // identité est gardée pour que les écrans ne recalculent pas les résultats.
        let valide: Projet;
        if (actuel !== undefined && actuel === projet) {
          valide = actuel;
        } else {
          const resultat = ProjetSchema.safeParse(projet);
          if (!resultat.success) {
            const erreurs: Record<string, string> = {};
            for (const issue of resultat.error.issues) {
              erreurs[issue.path.map(String).join('.')] = issue.message;
            }
            return { ok: false, erreurs };
          }
          valide = resultat.data;
        }
        modifier((e) =>
          avecProjet(e, id, (p) => ({
            ...p,
            ...complement,
            projet: valide,
            modifieLe: dateDeModification(p.modifieLe),
          })),
        );
        return { ok: true };
      },
    }),
    [etat.projets, modifier],
  );

  // Stables d'un rendu à l'autre : la synchronisation s'y abonne sans se relancer à chaque modification.
  const lire = useCallback((): EtatLocal => courant.current, []);
  const transformer = useCallback(
    (transformation: (e: EtatLocal) => EtatLocal): void => {
      ecrire(transformation(courant.current));
    },
    [ecrire],
  );
  const stockageProjets = useMemo<StockageProjets>(
    () => ({ lire, transformer, versionLocale }),
    [lire, transformer, versionLocale],
  );

  return (
    <ContexteStockage.Provider value={stockageProjets}>
      <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
    </ContexteStockage.Provider>
  );
}

export function useProjets(): ContexteProjets {
  const contexte = useContext(Contexte);
  if (contexte === null) {
    throw new Error('useProjets doit être utilisé sous ProjetsProvider');
  }
  return contexte;
}

/** Réservé à la synchronisation avec le compte (`stockage/synchro`). */
export function useStockageProjets(): StockageProjets {
  const contexte = useContext(ContexteStockage);
  if (contexte === null) {
    throw new Error('useStockageProjets doit être utilisé sous ProjetsProvider');
  }
  return contexte;
}
