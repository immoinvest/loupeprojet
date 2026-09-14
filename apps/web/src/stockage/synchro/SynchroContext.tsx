import { changerDeCompte, detacherCompte, oublierCompte } from '@loupe/projets';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useCompte } from '@/compte/CompteContext';

import { useStockageProjets } from '../ProjetsContext';
import { synchroniserTout } from './cycle';
import type { ClientProjets, StatutSynchro } from './types';

/** Après la dernière modification d'une rafale (saisie d'une hypothèse), l'envoi part une fois. */
export const DELAI_ENVOI_MS = 1_500;

/** Au retour sur l'onglet, les changements des autres appareils sont relus au plus toutes les 30 s. */
export const INTERVALLE_RETOUR_MS = 30_000;

export interface ContexteSynchro {
  readonly statut: StatutSynchro;
}

const Contexte = createContext<ContexteSynchro | null>(null);

export interface SynchroProviderProps {
  readonly client: ClientProjets;
  readonly delaiMs?: number;
  readonly children: ReactNode;
}

/**
 * Tient les projets de l'appareil à jour avec le compte connecté : à la connexion, après une
 * modification, au retour du réseau et sur l'onglet. Sans compte, ne fait rien (aucune requête).
 */
export function SynchroProvider({
  client,
  delaiMs = DELAI_ENVOI_MS,
  children,
}: SynchroProviderProps): ReactNode {
  const { etat: etatCompte, utilisateur, sortie } = useCompte();
  const { lire, transformer, versionLocale } = useStockageProjets();
  const compte = etatCompte === 'connecte' && utilisateur !== null ? utilisateur.id : null;
  const [statut, setStatut] = useState<StatutSynchro>('local');

  const compteCourant = useRef(compte);
  const enCours = useRef(false);
  // Demandes reçues : si l'une arrive pendant un cycle, un cycle de plus part à la fin.
  const demandes = useRef(0);
  const dernierCycle = useRef(0);
  const compteLie = useRef<string | null>(null);
  const versionVue = useRef(versionLocale);

  const lancer = useCallback(
    async (cible: string): Promise<void> => {
      demandes.current += 1;
      if (enCours.current) return;
      enCours.current = true;
      setStatut('en_cours');
      let resultat: StatutSynchro;
      let vues: number;
      do {
        vues = demandes.current;
        resultat = await synchroniserTout(client, { lire, transformer }, cible);
      } while (demandes.current !== vues && compteCourant.current === cible);
      enCours.current = false;
      dernierCycle.current = Date.now();
      if (compteCourant.current === cible) setStatut(resultat);
    },
    [client, lire, transformer],
  );

  // Connexion, changement de compte, déconnexion, suppression du compte.
  useEffect(() => {
    compteCourant.current = compte;
    if (etatCompte === 'chargement') return;
    if (compte !== null) {
      transformer((e) => changerDeCompte(e, compte));
      compteLie.current = compte;
      void lancer(compte);
      return;
    }
    // Une session absente au chargement ne touche à rien ; seule une sortie de cette session le fait.
    if (compteLie.current !== null) {
      if (sortie === 'deconnexion') transformer(oublierCompte);
      if (sortie === 'suppression') transformer(detacherCompte);
      compteLie.current = null;
    }
    setStatut('local');
  }, [etatCompte, compte, sortie, lancer, transformer]);

  // Une modification sur l'appareil : envoi après une courte pause.
  useEffect(() => {
    if (versionLocale === versionVue.current) return;
    versionVue.current = versionLocale;
    if (compte === null) return;
    const minuterie = setTimeout(() => {
      void lancer(compte);
    }, delaiMs);
    return () => {
      clearTimeout(minuterie);
    };
  }, [versionLocale, compte, lancer, delaiMs]);

  // Retour du réseau, retour sur l'onglet.
  useEffect(() => {
    if (compte === null) return;
    const auRetourDuReseau = (): void => {
      void lancer(compte);
    };
    const auRetourSurLOnglet = (): void => {
      const assezTard = Date.now() - dernierCycle.current >= INTERVALLE_RETOUR_MS;
      if (document.visibilityState === 'visible' && assezTard) void lancer(compte);
    };
    window.addEventListener('online', auRetourDuReseau);
    document.addEventListener('visibilitychange', auRetourSurLOnglet);
    return () => {
      window.removeEventListener('online', auRetourDuReseau);
      document.removeEventListener('visibilitychange', auRetourSurLOnglet);
    };
  }, [compte, lancer]);

  const valeur = useMemo<ContexteSynchro>(() => ({ statut }), [statut]);
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useSynchro(): ContexteSynchro {
  const contexte = useContext(Contexte);
  if (contexte === null) {
    throw new Error('useSynchro doit être utilisé sous SynchroProvider');
  }
  return contexte;
}
