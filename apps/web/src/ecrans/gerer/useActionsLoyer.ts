import type {
  DemandeDocument,
  IdentiteBailleur,
  LigneLoyer,
  NouveauPaiement,
} from '@loupe/gestion';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { REGLES_ENVOIS } from '@loupe/gestion';

import { useEnvois } from '@/gestion/envois/EnvoisContext';
import { quittancePartira } from '@/gestion/envois/logique';
import { useGestion } from '@/gestion/GestionContext';
import { cheminDe, lienDocument } from '@/gestion/parcours';
import { ERREURS_GESTION } from '@/textes/gerer';
import { loyerRecu, TEXTES_GERER } from '@/textes/gerer-ecrans';
import { TEXTES_ENVOIS } from '@/textes/gerer-envois';
import { paiementEnregistre } from '@/textes/gerer-loyers';

/** La quittance part 12 s après « Reçu » (ADR-G43) : sa trace est relue un peu après. */
const RELECTURE_APRES_RECU_MS = (REGLES_ENVOIS.delaiQuittanceSecondes + 4) * 1000;

/** Durée pendant laquelle « Annuler » reste proposé après un paiement. */
export const DUREE_ANNULATION_MS = 10_000;

export interface Annulation {
  readonly paiementId: string;
  readonly message: string;
}

/** La carte d'identité du bailleur, ouverte par un document demandé avant qu'elle soit connue. */
export interface IdentiteDemandee {
  readonly demande: DemandeDocument;
  readonly erreur: string | null;
}

export interface ActionsLoyer {
  readonly occupe: boolean;
  readonly erreur: string | null;
  readonly annulation: Annulation | null;
  /** La location dont le formulaire « En partie » est ouvert. */
  readonly enPartie: string | null;
  readonly identite: IdentiteDemandee | null;
  readonly ouvrirEnPartie: (locationId: string | null) => void;
  /** « Reçu » : ce qui reste dû, payé aujourd'hui (un clic). */
  readonly marquerRecu: (ligne: LigneLoyer) => Promise<void>;
  readonly enregistrerPartiel: (paiement: NouveauPaiement) => Promise<void>;
  readonly annuler: (annulation: Annulation) => Promise<void>;
  /** « Quittance » ou « Reçu de … » : émet le document puis l'ouvre (un clic). */
  readonly ouvrirDocument: (demande: DemandeDocument) => Promise<void>;
  /** Enregistre l'identité puis ouvre le document qui l'attendait. */
  readonly enregistrerIdentite: (
    demande: DemandeDocument,
    identite: IdentiteBailleur,
  ) => Promise<void>;
  readonly abandonnerIdentite: () => void;
}

function prenomDe(ligne: LigneLoyer): string {
  return ligne.locataire?.prenom ?? TEXTES_GERER.tonLocataire;
}

/** Les actions d'un loyer, partagées par l'accueil de Gérer et la page Loyers. */
export function useActionsLoyer(aujourdhui: string): ActionsLoyer {
  const { payer, annulerPaiement, emettreDocument, enregistrerBailleur } = useGestion();
  const envois = useEnvois();
  const naviguer = useNavigate();
  // La page où l'on ouvre un document : son lien de retour y ramène (ADR-G20).
  const location = useLocation();
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [annulation, setAnnulation] = useState<Annulation | null>(null);
  const [enPartie, setEnPartie] = useState<string | null>(null);
  const [identite, setIdentite] = useState<IdentiteDemandee | null>(null);

  useEffect(() => {
    if (annulation === null) return undefined;
    const minuteur = window.setTimeout(() => {
      setAnnulation(null);
    }, DUREE_ANNULATION_MS);
    return () => {
      window.clearTimeout(minuteur);
    };
  }, [annulation]);

  const enregistrer = async (paiement: NouveauPaiement, message: string): Promise<boolean> => {
    setOccupe(true);
    const r = await payer(paiement);
    setOccupe(false);
    setErreur(r.ok ? null : ERREURS_GESTION[r.code]);
    setAnnulation(r.ok ? { paiementId: r.valeur.id, message } : null);
    return r.ok;
  };

  const ouvrirDocument = async (demande: DemandeDocument): Promise<void> => {
    setOccupe(true);
    const r = await emettreDocument(demande);
    setOccupe(false);
    if (r.ok) {
      void naviguer(lienDocument(r.valeur.id, cheminDe(location)));
      return;
    }
    if (r.code === 'bailleur_manquant') {
      setErreur(null);
      setIdentite({ demande, erreur: null });
      return;
    }
    setErreur(ERREURS_GESTION[r.code]);
  };

  return {
    occupe,
    erreur,
    annulation,
    enPartie,
    identite,
    ouvrirEnPartie: setEnPartie,
    marquerRecu: async (ligne) => {
      const paiement = {
        locationId: ligne.location.id,
        periode: ligne.du.periode,
        montant: ligne.resteDu,
        date: aujourdhui,
      };
      const partira = quittancePartira(envois.donnees, ligne.location);
      const message = partira
        ? `${loyerRecu(prenomDe(ligne))} ${TEXTES_ENVOIS.quittancePartira}`
        : loyerRecu(prenomDe(ligne));
      if ((await enregistrer(paiement, message)) && partira) {
        envois.rechargerDans(RELECTURE_APRES_RECU_MS);
      }
    },
    enregistrerPartiel: async (paiement) => {
      if (await enregistrer(paiement, paiementEnregistre(paiement.montant))) setEnPartie(null);
    },
    annuler: async (a) => {
      setOccupe(true);
      const r = await annulerPaiement(a.paiementId);
      setOccupe(false);
      setAnnulation(null);
      setErreur(r.ok ? null : ERREURS_GESTION[r.code]);
    },
    ouvrirDocument,
    enregistrerIdentite: async (demande, saisie) => {
      setOccupe(true);
      const r = await enregistrerBailleur(saisie);
      setOccupe(false);
      if (!r.ok) {
        setIdentite({ demande, erreur: ERREURS_GESTION[r.code] });
        return;
      }
      setIdentite(null);
      await ouvrirDocument(demande);
    },
    abandonnerIdentite: () => {
      setIdentite(null);
    },
  };
}
