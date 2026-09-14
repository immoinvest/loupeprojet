import {
  cleDocument,
  contenuQuittance,
  contenuRecu,
  type DemandeDocument,
  type DocumentComplet,
  type DocumentGestion,
  type EtatGestion,
  type RefusDocument,
} from '@loupe/gestion';

import type { CodeErreurGestion, ResultatGestion } from './types';

const CODES_REFUS: Readonly<Record<RefusDocument, CodeErreurGestion>> = {
  BAILLEUR_MANQUANT: 'bailleur_manquant',
  INTROUVABLE: 'introuvable',
  HORS_LOCATION: 'invalide',
  LOYER_NON_REGLE: 'loyer_non_regle',
  LOYER_REGLE: 'loyer_regle',
};

/** La clé d'unicité d'un document émis : la quittance d'un mois ou le reçu d'un paiement (ADR-G9). */
export function cleDuDocument(document: DocumentGestion): string {
  return document.paiementId === undefined
    ? cleDocument({
        type: 'quittance',
        locationId: document.locationId,
        periode: document.periode,
      })
    : cleDocument({ type: 'recu', paiementId: document.paiementId });
}

/**
 * Le document d'une demande, écrit sur les données en mémoire avec les mêmes règles que l'API :
 * bien, locataire en titre puis colocataires, paiements de la location.
 */
export function documentEnMemoire(
  donnees: EtatGestion,
  demande: DemandeDocument,
  id: string,
  maintenant: string,
): ResultatGestion<DocumentComplet> {
  const locationId =
    demande.type === 'quittance'
      ? demande.locationId
      : donnees.paiements.find((p) => p.id === demande.paiementId)?.locationId;
  const location = donnees.locations.find((l) => l.id === locationId);
  const bien = donnees.biens.find((b) => b.id === location?.bienId);
  if (location === undefined || bien === undefined) return { ok: false, code: 'introuvable' };

  const entrees = {
    bailleur: donnees.bailleur,
    bien,
    locataires: [location.locataireId, ...location.colocataireIds].flatMap((idLocataire) =>
      donnees.locataires.filter((l) => l.id === idLocataire),
    ),
    location,
    paiements: donnees.paiements,
    emisLe: maintenant.slice(0, 10),
  };
  const resultat =
    demande.type === 'quittance'
      ? contenuQuittance(entrees, demande.periode)
      : contenuRecu(entrees, demande.paiementId);
  if (!resultat.ok) return { ok: false, code: CODES_REFUS[resultat.refus] };

  const { contenu } = resultat;
  return {
    ok: true,
    valeur: {
      id,
      type: contenu.type,
      numero: contenu.numero,
      locationId: location.id,
      periode: contenu.periode,
      ...(demande.type === 'recu' ? { paiementId: demande.paiementId } : {}),
      emisLe: maintenant,
      contenu,
    },
  };
}
