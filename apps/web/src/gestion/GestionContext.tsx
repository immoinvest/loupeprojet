import {
  DocumentSchema,
  PREFERENCES_PAR_DEFAUT,
  type CreationLocation,
  type CreationReponse,
  type DemandeDocument,
  type DocumentComplet,
  type EtatGestion,
  type IdentiteBailleur,
  type NouveauPaiement,
  type Paiement,
  type PreferencesMenu,
} from '@loupe/gestion';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useCompte, type EtatCompte } from '@/compte/CompteContext';

import { ecrirePreferencesLocales, lirePreferencesLocales, sectionsAffichees } from './menu';
import type { ClientGestion, CodeErreurGestion, ResultatGestion } from './types';

/** `anonyme` : pas de compte ; `chargement` : compte ou données en route ; `pret` ; `erreur`. */
export type StatutGestion = 'anonyme' | 'chargement' | 'pret' | 'erreur';

export interface ContexteGestion {
  readonly statut: StatutGestion;
  /** Les données du compte, seulement quand `statut` vaut `pret`. */
  readonly donnees: EtatGestion | null;
  readonly erreur: CodeErreurGestion | null;
  /** Les préférences du menu (celles du compte, sinon leur copie locale, sinon les deux sections). */
  readonly preferences: PreferencesMenu;
  /** Les sections à afficher dans le menu. */
  readonly sections: PreferencesMenu;
  readonly recharger: () => void;
  readonly creer: (creation: CreationLocation) => Promise<ResultatGestion<CreationReponse>>;
  readonly payer: (paiement: NouveauPaiement) => Promise<ResultatGestion<Paiement>>;
  readonly annulerPaiement: (paiementId: string) => Promise<ResultatGestion>;
  readonly changerPreferences: (
    preferences: PreferencesMenu,
  ) => Promise<ResultatGestion<PreferencesMenu>>;
  readonly enregistrerBailleur: (
    identite: IdentiteBailleur,
  ) => Promise<ResultatGestion<IdentiteBailleur>>;
  /** Émet (ou retrouve) le document ; l'état liste ensuite le document, sans son contenu. */
  readonly emettreDocument: (demande: DemandeDocument) => Promise<ResultatGestion<DocumentComplet>>;
  readonly document: (id: string) => Promise<ResultatGestion<DocumentComplet>>;
}

const Contexte = createContext<ContexteGestion | null>(null);

type Chargement = 'chargement' | 'pret' | 'erreur';

function statutVisible(etatCompte: EtatCompte, chargement: Chargement): StatutGestion {
  if (etatCompte === 'connecte') return chargement;
  return etatCompte;
}

/** Les données de gestion sont lues quand le compte est connecté ; les actions les tiennent à jour. */
export function GestionProvider({
  client,
  stockage,
  children,
}: {
  client: ClientGestion;
  stockage?: Storage | undefined;
  children: ReactNode;
}): ReactNode {
  const { etat: etatCompte } = useCompte();
  const store = stockage ?? window.localStorage;
  const [chargement, setChargement] = useState<Chargement>('chargement');
  const [donnees, setDonnees] = useState<EtatGestion | null>(null);
  const [erreur, setErreur] = useState<CodeErreurGestion | null>(null);
  const [preferences, setPreferences] = useState<PreferencesMenu>(
    () => lirePreferencesLocales(store) ?? PREFERENCES_PAR_DEFAUT,
  );
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
      setPreferences(r.valeur.preferences);
      ecrirePreferencesLocales(store, r.valeur.preferences);
      setErreur(null);
      setChargement('pret');
    });
  }, [client, connecte, store, version]);

  const valeur = useMemo<ContexteGestion>(() => {
    const statut = statutVisible(etatCompte, chargement);
    const fusionner = (changer: (e: EtatGestion) => EtatGestion): void => {
      setDonnees((e) => (e === null ? e : changer(e)));
    };
    const appliquerPreferences = (p: PreferencesMenu): void => {
      setPreferences(p);
      ecrirePreferencesLocales(store, p);
      fusionner((e) => ({ ...e, preferences: p }));
    };

    return {
      statut,
      donnees: statut === 'pret' ? donnees : null,
      erreur: statut === 'erreur' ? erreur : null,
      preferences,
      sections: sectionsAffichees(etatCompte, preferences),
      recharger: () => {
        setVersion((v) => v + 1);
      },
      creer: async (creation) => {
        const r = await client.creer(creation);
        if (r.ok) {
          const { bien, locataire, location, colocataires } = r.valeur;
          fusionner((e) => ({
            ...e,
            biens: [...e.biens, bien],
            locataires: [
              ...e.locataires,
              ...(locataire === null ? [] : [locataire]),
              ...colocataires,
            ],
            locations: location === null ? e.locations : [...e.locations, location],
          }));
        }
        return r;
      },
      payer: async (paiement) => {
        const r = await client.payer(paiement);
        if (r.ok) {
          const { valeur: paye } = r;
          fusionner((e) => ({ ...e, paiements: [...e.paiements, paye] }));
        }
        return r;
      },
      annulerPaiement: async (paiementId) => {
        const r = await client.annulerPaiement(paiementId);
        if (r.ok) {
          fusionner((e) => ({ ...e, paiements: e.paiements.filter((p) => p.id !== paiementId) }));
        }
        return r;
      },
      changerPreferences: async (suivantes) => {
        const avant = preferences;
        appliquerPreferences(suivantes);
        const r = await client.enregistrerPreferences(suivantes);
        if (!r.ok) appliquerPreferences(avant);
        return r;
      },
      enregistrerBailleur: async (identite) => {
        const r = await client.enregistrerBailleur(identite);
        if (r.ok) {
          const { valeur: bailleur } = r;
          fusionner((e) => ({ ...e, bailleur }));
        }
        return r;
      },
      emettreDocument: async (demande) => {
        const r = await client.emettreDocument(demande);
        if (r.ok) {
          const liste = DocumentSchema.parse(r.valeur);
          fusionner((e) =>
            e.documents.some((d) => d.id === liste.id)
              ? e
              : { ...e, documents: [...e.documents, liste] },
          );
        }
        return r;
      },
      document: (id) => client.document(id),
    };
  }, [client, etatCompte, chargement, donnees, erreur, preferences, store]);

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useGestion(): ContexteGestion {
  const contexte = useContext(Contexte);
  if (contexte === null) {
    throw new Error('useGestion doit être utilisé sous GestionProvider');
  }
  return contexte;
}
