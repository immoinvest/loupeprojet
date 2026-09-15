import {
  LettreRevisionSchema,
  type EtatBail,
  type LegalBien,
  type LegalBienSaisie,
  type LettreRevisionComplete,
  type RevisionAppliquee,
  type RevisionLocation,
  type RevisionSaisie,
} from '@loupe/gestion';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useCompte } from '@/compte/CompteContext';

import { useGestion } from '../GestionContext';
import type { ClientBail, CodeErreurBail, ResultatBail } from './types';

/**
 * `anonyme` : pas de compte ; `chargement` ; `pret` ; `indisponible` : la migration 0008 manque ou
 * l'API ne répond pas (les cartes disent « Bientôt disponible », le reste de Gérer continue) ; `erreur`.
 */
export type StatutBail = 'anonyme' | 'chargement' | 'pret' | 'indisponible' | 'erreur';

export interface ContexteBail {
  readonly statut: StatutBail;
  readonly donnees: EtatBail | null;
  readonly erreur: CodeErreurBail | null;
  readonly enregistrerBien: (
    bienId: string,
    saisie: LegalBienSaisie,
  ) => Promise<ResultatBail<LegalBien>>;
  readonly enregistrerRevision: (
    locationId: string,
    saisie: RevisionSaisie,
  ) => Promise<ResultatBail<RevisionLocation>>;
  /** Applique la révision ; la location aux nouveaux montants remplace l'ancienne dans Gérer. */
  readonly appliquerRevision: (
    locationId: string,
    anniversaire: string,
  ) => Promise<ResultatBail<RevisionAppliquee>>;
  readonly lettre: (id: string) => Promise<ResultatBail<LettreRevisionComplete>>;
}

const INDISPONIBLE = { ok: false, code: 'indisponible' } as const;

/** Sans fournisseur (écran monté seul) : rien de la vie du bail, aucune écriture. */
const SANS_BAIL: ContexteBail = {
  statut: 'anonyme',
  donnees: null,
  erreur: null,
  enregistrerBien: () => Promise.resolve(INDISPONIBLE),
  enregistrerRevision: () => Promise.resolve(INDISPONIBLE),
  appliquerRevision: () => Promise.resolve(INDISPONIBLE),
  lettre: () => Promise.resolve(INDISPONIBLE),
};

const Contexte = createContext<ContexteBail>(SANS_BAIL);

function remplacer<T>(liste: readonly T[], nouveau: T, meme: (t: T) => boolean): T[] {
  return [...liste.filter((t) => !meme(t)), nouveau];
}

/** Lit la vie du bail quand le compte est connecté ; les actions tiennent l'état à jour. */
export function BailProvider({
  client,
  children,
}: {
  readonly client: ClientBail;
  readonly children: ReactNode;
}): ReactNode {
  const { etat: etatCompte } = useCompte();
  const { integrerLocation } = useGestion();
  const [statut, setStatut] = useState<Exclude<StatutBail, 'anonyme'>>('chargement');
  const [donnees, setDonnees] = useState<EtatBail | null>(null);
  const [erreur, setErreur] = useState<CodeErreurBail | null>(null);
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

  const valeur = useMemo<ContexteBail>(() => {
    const changer = (f: (e: EtatBail) => EtatBail): void => {
      setDonnees((e) => (e === null ? e : f(e)));
    };
    return {
      statut: connecte ? statut : 'anonyme',
      donnees: connecte && statut === 'pret' ? donnees : null,
      erreur: connecte ? erreur : null,
      enregistrerBien: async (bienId, saisie) => {
        const r = await client.enregistrerBien(bienId, saisie);
        if (r.ok) {
          const { valeur: legal } = r;
          changer((e) => ({ ...e, biens: remplacer(e.biens, legal, (b) => b.bienId === bienId) }));
        }
        return r;
      },
      enregistrerRevision: async (locationId, saisie) => {
        const r = await client.enregistrerRevision(locationId, saisie);
        if (r.ok) {
          const { valeur: revision } = r;
          changer((e) => ({
            ...e,
            revisions: remplacer(e.revisions, revision, (x) => x.locationId === locationId),
          }));
        }
        return r;
      },
      appliquerRevision: async (locationId, anniversaire) => {
        const r = await client.appliquerRevision(locationId, anniversaire);
        if (r.ok) {
          const { lettre, revision, location } = r.valeur;
          // L'état liste la lettre sans son contenu (Zod retire les champs inconnus).
          const listee = LettreRevisionSchema.parse(lettre);
          changer((e) => ({
            ...e,
            revisions: remplacer(e.revisions, revision, (x) => x.locationId === locationId),
            lettres: remplacer(e.lettres, listee, (l) => l.id === lettre.id),
          }));
          integrerLocation(location);
        }
        return r;
      },
      lettre: (id) => client.lettre(id),
    };
  }, [client, connecte, statut, donnees, erreur, integrerLocation]);

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useBail(): ContexteBail {
  return useContext(Contexte);
}
