import type {
  ChangementColocataire,
  ColocataireChange,
  CongeSaisie,
  DecompteComplet,
  EtatFinBail,
  ModeCharges,
  ModeChargesLocation,
  Regularisation,
  RegularisationValidee,
  Restitution,
  RestitutionEnregistree,
  RestitutionSaisie,
} from '@loupe/gestion';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useCompte } from '@/compte/CompteContext';

import { useGestion } from '../GestionContext';
import type { ClientFinBail, CodeErreurFinBail, ResultatFinBail } from './types';

/**
 * `anonyme` : pas de compte ; `chargement` ; `pret` ; `indisponible` : la migration 0011 manque ou
 * l'API ne répond pas (nos sections disent « Bientôt disponible », le reste de Gérer continue) ; `erreur`.
 */
export type StatutFinBail = 'anonyme' | 'chargement' | 'pret' | 'indisponible' | 'erreur';

export interface ContexteFinBail {
  readonly statut: StatutFinBail;
  readonly donnees: EtatFinBail | null;
  readonly erreur: CodeErreurFinBail | null;
  /** Enregistre le congé ; la location à sa nouvelle sortie remplace l'ancienne dans Gérer. */
  readonly enregistrerConge: (
    locationId: string,
    saisie: CongeSaisie,
  ) => Promise<ResultatFinBail<unknown>>;
  readonly retirerConge: (locationId: string) => Promise<ResultatFinBail<unknown>>;
  readonly enregistrerModeCharges: (
    locationId: string,
    mode: ModeCharges,
  ) => Promise<ResultatFinBail<ModeChargesLocation>>;
  readonly restituer: (
    locationId: string,
    saisie: RestitutionSaisie,
  ) => Promise<ResultatFinBail<RestitutionEnregistree>>;
  readonly rendreDepot: (
    locationId: string,
    rendueLe: string,
  ) => Promise<ResultatFinBail<Restitution>>;
  readonly annulerRestitution: (locationId: string) => Promise<ResultatFinBail>;
  readonly regulariser: (
    locationId: string,
    annee: number,
  ) => Promise<ResultatFinBail<RegularisationValidee>>;
  readonly reglerRegularisation: (
    id: string,
    regleeLe: string,
  ) => Promise<ResultatFinBail<Regularisation>>;
  /** Le colocataire qui arrive rejoint aussi les locataires et la location de Gérer. */
  readonly changerColocataire: (
    locationId: string,
    changement: ChangementColocataire,
  ) => Promise<ResultatFinBail<ColocataireChange>>;
  readonly decompte: (id: string) => Promise<ResultatFinBail<DecompteComplet>>;
}

const INDISPONIBLE = { ok: false, code: 'indisponible' } as const;

/** Sans fournisseur (écran monté seul) : rien de la fin du bail, aucune écriture. */
const SANS_FIN_BAIL: ContexteFinBail = {
  statut: 'anonyme',
  donnees: null,
  erreur: null,
  enregistrerConge: () => Promise.resolve(INDISPONIBLE),
  retirerConge: () => Promise.resolve(INDISPONIBLE),
  enregistrerModeCharges: () => Promise.resolve(INDISPONIBLE),
  restituer: () => Promise.resolve(INDISPONIBLE),
  rendreDepot: () => Promise.resolve(INDISPONIBLE),
  annulerRestitution: () => Promise.resolve(INDISPONIBLE),
  regulariser: () => Promise.resolve(INDISPONIBLE),
  reglerRegularisation: () => Promise.resolve(INDISPONIBLE),
  changerColocataire: () => Promise.resolve(INDISPONIBLE),
  decompte: () => Promise.resolve(INDISPONIBLE),
};

const Contexte = createContext<ContexteFinBail>(SANS_FIN_BAIL);

function remplacer<T>(liste: readonly T[], nouveau: T, meme: (t: T) => boolean): T[] {
  return [...liste.filter((t) => !meme(t)), nouveau];
}

/** Lit la fin du bail quand le compte est connecté ; les actions tiennent l'état à jour. */
export function FinBailProvider({
  client,
  children,
}: {
  readonly client: ClientFinBail;
  readonly children: ReactNode;
}): ReactNode {
  const { etat: etatCompte } = useCompte();
  const { integrerLocation, integrerLocataire } = useGestion();
  const [statut, setStatut] = useState<Exclude<StatutFinBail, 'anonyme'>>('chargement');
  const [donnees, setDonnees] = useState<EtatFinBail | null>(null);
  const [erreur, setErreur] = useState<CodeErreurFinBail | null>(null);
  const connecte = etatCompte === 'connecte';

  useEffect(() => {
    if (!connecte) return;
    setStatut('chargement');
    void client.etat().then((r) => {
      if (r.ok) {
        setDonnees(r.valeur);
        setErreur(null);
        setStatut('pret');
        return;
      }
      setErreur(r.code);
      setStatut(r.code === 'indisponible' ? 'indisponible' : 'erreur');
    });
  }, [client, connecte]);

  const valeur = useMemo<ContexteFinBail>(() => {
    const changer = (f: (e: EtatFinBail) => EtatFinBail): void => {
      setDonnees((e) => (e === null ? e : f(e)));
    };
    const memeLocation =
      (locationId: string) =>
      (ligne: { readonly locationId: string }): boolean =>
        ligne.locationId === locationId;

    return {
      statut: connecte ? statut : 'anonyme',
      donnees: connecte && statut === 'pret' ? donnees : null,
      erreur: connecte ? erreur : null,

      enregistrerConge: async (locationId, saisie) => {
        const r = await client.enregistrerConge(locationId, saisie);
        if (r.ok) {
          const { conge, location } = r.valeur;
          changer((e) => ({ ...e, conges: remplacer(e.conges, conge, memeLocation(locationId)) }));
          integrerLocation(location);
        }
        return r;
      },
      retirerConge: async (locationId) => {
        const r = await client.retirerConge(locationId);
        if (r.ok) {
          changer((e) => ({ ...e, conges: e.conges.filter((c) => c.locationId !== locationId) }));
          integrerLocation(r.valeur.location);
        }
        return r;
      },
      enregistrerModeCharges: async (locationId, mode) => {
        const r = await client.enregistrerModeCharges(locationId, mode);
        if (r.ok) {
          const { valeur: ligne } = r;
          changer((e) => ({
            ...e,
            charges: remplacer(e.charges, ligne, memeLocation(locationId)),
          }));
        }
        return r;
      },
      restituer: async (locationId, saisie) => {
        const r = await client.restituer(locationId, saisie);
        if (r.ok) {
          const { restitution, decompte } = r.valeur;
          changer((e) => ({
            ...e,
            restitutions: remplacer(e.restitutions, restitution, memeLocation(locationId)),
            decomptes: remplacer(e.decomptes, decompte, (d) => d.id === decompte.id),
          }));
        }
        return r;
      },
      rendreDepot: async (locationId, rendueLe) => {
        const r = await client.rendreDepot(locationId, rendueLe);
        if (r.ok) {
          const { valeur: restitution } = r;
          changer((e) => ({
            ...e,
            restitutions: remplacer(e.restitutions, restitution, memeLocation(locationId)),
          }));
        }
        return r;
      },
      annulerRestitution: async (locationId) => {
        const r = await client.annulerRestitution(locationId);
        if (r.ok) {
          changer((e) => {
            const retiree = e.restitutions.find((x) => x.locationId === locationId);
            return {
              ...e,
              restitutions: e.restitutions.filter((x) => x.locationId !== locationId),
              decomptes: e.decomptes.filter((d) => d.id !== retiree?.decompteId),
            };
          });
        }
        return r;
      },
      regulariser: async (locationId, annee) => {
        const r = await client.regulariser(locationId, annee);
        if (r.ok) {
          const { regularisation, decompte } = r.valeur;
          changer((e) => ({
            ...e,
            regularisations: remplacer(
              e.regularisations,
              regularisation,
              (x) => x.id === regularisation.id,
            ),
            decomptes: remplacer(e.decomptes, decompte, (d) => d.id === decompte.id),
          }));
        }
        return r;
      },
      reglerRegularisation: async (id, regleeLe) => {
        const r = await client.reglerRegularisation(id, regleeLe);
        if (r.ok) {
          const { valeur: reglee } = r;
          changer((e) => ({
            ...e,
            regularisations: remplacer(e.regularisations, reglee, (x) => x.id === reglee.id),
          }));
        }
        return r;
      },
      changerColocataire: async (locationId, changement) => {
        const r = await client.changerColocataire(locationId, changement);
        if (r.ok) {
          const { location, locataire, mouvements } = r.valeur;
          changer((e) => ({ ...e, mouvements: [...e.mouvements, ...mouvements] }));
          if (locataire !== null) integrerLocataire(locataire);
          integrerLocation(location);
        }
        return r;
      },
      decompte: (id) => client.decompte(id),
    };
  }, [client, connecte, statut, donnees, erreur, integrerLocation, integrerLocataire]);

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useFinBail(): ContexteFinBail {
  return useContext(Contexte);
}
