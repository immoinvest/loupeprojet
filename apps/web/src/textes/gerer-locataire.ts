import type { TonPastille } from '@/composants/ui';
import type { EtatOccupation } from '@/gestion/fiche-locataire';

import { TEXTES_LOCATAIRES } from './gerer-locataires';

/** Textes de la fiche d'un locataire (tutoiement). */
export const TEXTES_FICHE_LOCATAIRE = {
  introuvable: 'Locataire introuvable',
  introuvableTexte: 'Ce locataire n’existe pas, ou il appartient à un autre compte.',
  voirLocataires: 'Voir mes locataires',
  emailManquant: TEXTES_LOCATAIRES.emailManquant,
  ajouterEmail: 'Ajouter l’e-mail',
  modifier: TEXTES_LOCATAIRES.modifier,
  aucuneLocation: 'Aucune location pour ce locataire.',
  sesLoyers: 'Ses 12 derniers loyers',
  aucunLoyer: 'Aucun loyer dû ces 12 derniers mois.',
  periode: 'Période',
  loyer: 'Loyer hors charges',
  charges: 'Charges',
  apl: 'APL versée par la CAF',
  avec: 'Avec',
} as const;

export const ETATS_OCCUPATION: Readonly<Record<EtatOccupation, string>> = {
  en_cours: 'En cours',
  a_venir: 'À venir',
  terminee: 'Terminée',
};

export const TONS_OCCUPATION: Readonly<Record<EtatOccupation, TonPastille>> = {
  en_cours: 'bon',
  a_venir: 'accent',
  terminee: 'neutre',
};
