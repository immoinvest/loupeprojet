import type { ContenuDocument, MentionDocument, TypeDocument } from '@loupe/gestion';

import { dateEnLettres, montant } from '@/gestion/format';

import { bienEtChambre, nomsDesLocataires } from './gerer-loyers';

/**
 * Textes de la quittance et du reçu (loi n° 89-462 du 6 juillet 1989, art. 21) et de leur page
 * d'impression. Le document s'adresse au locataire : phrases à la troisième personne, sans tutoiement.
 */
export const TEXTES_DOCUMENT = {
  retour: 'Loyers',
  apercu:
    'Aperçu du document. Dans la fenêtre d’impression, choisissez « Enregistrer au format PDF ».',
  imprimer: 'Imprimer ou enregistrer en PDF',
  chargement: 'Chargement du document…',
  introuvable: 'Document introuvable',
  introuvableTexte: 'Ce document n’existe pas, ou il appartient à un autre compte.',
  bailleur: 'Bailleur',
  logement: 'Logement loué',
  periode: 'Période',
  loyer: 'Loyer hors charges',
  charges: 'Charges',
  total: 'Total du terme',
  /** Tiers payant (ADR-G16) : l'aide comprise dans le total, puis ce qui reste au locataire. */
  apl: 'Dont aide au logement versée par la CAF',
  partLocataire: 'Payé par le locataire',
  /** Drapeau « à confirmer » (APL_QUITTANCE, règles de gestion) : visible à l'aperçu, jamais imprimé. */
  aplAConfirmer: 'Mention de l’aide au logement : formulation à confirmer auprès de la CAF.',
  paiements: 'Paiements reçus',
  paiementAtteste: 'Paiement reçu',
  dejaRecu: 'Déjà reçu pour ce terme',
  resteDu: 'Reste dû',
  gratuit: 'Document délivré gratuitement (loi n° 89-462 du 6 juillet 1989, article 21).',
} as const;

export const TITRES_DOCUMENT: Readonly<Record<TypeDocument, string>> = {
  quittance: 'Quittance de loyer',
  recu: 'Reçu de paiement',
};

/** Les mentions portées en codes par le contenu figé. */
export const MENTIONS_DOCUMENT_TEXTES: Readonly<Record<MentionDocument, string>> = {
  pour_acquit: 'Pour acquit.',
  annule_recus:
    'Cette quittance annule les reçus délivrés pour les paiements partiels de cette période.',
};

export function locatairesTitre(nombre: number): string {
  return nombre > 1 ? 'Locataires' : 'Locataire';
}

export function numeroEnLettres(numero: string): string {
  return `N° ${numero}`;
}

/** « du 1er octobre 2026 au 31 octobre 2026 ». */
export function periodeEnLettres(debut: string, fin: string): string {
  return `du ${dateEnLettres(debut)} au ${dateEnLettres(fin)}`;
}

/** « Coloc Rouet · Chambre 2, 3 rue du Rouet, Marseille 6e ». */
export function logementEnLettres(logement: ContenuDocument['logement']): string {
  return `${bienEtChambre(logement.nom, logement.libelle)}, ${logement.adresse}`;
}

/** « 300 € le 6 octobre 2026 ». */
export function paiementEnLettres(paiement: { montant: number; date: string }): string {
  return `${montant(paiement.montant)} le ${dateEnLettres(paiement.date)}`;
}

export function faitLe(jour: string): string {
  return `Fait le ${dateEnLettres(jour)}.`;
}

/** La phrase par laquelle le bailleur atteste le loyer du terme (quittance) ou un paiement partiel (reçu). */
export function declaration(contenu: ContenuDocument): string {
  const noms = nomsDesLocataires(contenu.locataires.map((l) => `${l.prenom} ${l.nom}`));
  const debut = `${contenu.bailleur.nom}, bailleur du logement désigné ci-dessus, déclare avoir reçu de ${noms} la somme de ${montant(contenu.montantRecu)}`;
  const periode = periodeEnLettres(contenu.debut, contenu.fin);
  return contenu.type === 'quittance'
    ? `${debut} au titre du loyer et des charges de la période ${periode}, et en donne quittance, sous réserve de tous ses droits.`
    : `${debut}, en paiement partiel du loyer et des charges de la période ${periode}. Ce reçu ne vaut pas quittance.`;
}
