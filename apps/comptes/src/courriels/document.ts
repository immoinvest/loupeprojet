import type { ContenuDocument, MentionDocument, TypeDocument } from '@loupe/gestion';

import { dateEnLettres, montant, nomsDesLocataires } from './format';

/**
 * Les phrases de la quittance et du reçu pour le PDF envoyé par e-mail : les mêmes que la page
 * imprimable (apps/web/src/textes/gerer-documents.ts), écrites depuis le contenu figé (ADR-G40).
 */
export const TEXTES_DOCUMENT = {
  bailleur: 'Bailleur',
  logement: 'Logement loué',
  periode: 'Période',
  loyer: 'Loyer hors charges',
  charges: 'Charges',
  total: 'Total du terme',
  apl: 'Dont aide au logement versée par la CAF',
  partLocataire: 'Payé par le locataire',
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

export function periodeEnLettres(debut: string, fin: string): string {
  return `du ${dateEnLettres(debut)} au ${dateEnLettres(fin)}`;
}

/** « Coloc Rouet · Chambre 2, 3 rue du Rouet ». */
export function logementEnLettres(logement: ContenuDocument['logement']): string {
  const nom =
    logement.libelle === undefined ? logement.nom : `${logement.nom} · ${logement.libelle}`;
  return `${nom}, ${logement.adresse}`;
}

export function paiementEnLettres(paiement: { montant: number; date: string }): string {
  return `${montant(paiement.montant)} le ${dateEnLettres(paiement.date)}`;
}

export function faitLe(jour: string): string {
  return `Fait le ${dateEnLettres(jour)}.`;
}

export function declaration(contenu: ContenuDocument): string {
  const noms = nomsDesLocataires(contenu.locataires.map((l) => `${l.prenom} ${l.nom}`));
  const debut = `${contenu.bailleur.nom}, bailleur du logement désigné ci-dessus, déclare avoir reçu de ${noms} la somme de ${montant(contenu.montantRecu)}`;
  const periode = periodeEnLettres(contenu.debut, contenu.fin);
  return contenu.type === 'quittance'
    ? `${debut} au titre du loyer et des charges de la période ${periode}, et en donne quittance, sous réserve de tous ses droits.`
    : `${debut}, en paiement partiel du loyer et des charges de la période ${periode}. Ce reçu ne vaut pas quittance.`;
}
