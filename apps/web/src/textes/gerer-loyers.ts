import type { ChampEnPartie, GroupeLoyer } from '@/gestion/loyers-page';
import { montant } from '@/gestion/format';

/** Textes de la page Loyers et des actions d'un loyer (tutoiement). */
export const TEXTES_LOYERS = {
  titre: 'Loyers',
  choixDuMois: 'Choix du mois',
  moisPrecedent: 'Mois précédent',
  moisSuivant: 'Mois suivant',
  aucun: 'Aucun loyer ce mois-ci.',
  voirTous: 'Voir tous les loyers',
  enPartie: 'En partie',
  montantRecu: 'Montant reçu',
  dateDuPaiement: 'Date du paiement',
  enregistrer: 'Enregistrer',
  fermer: 'Fermer',
  quittance: 'Quittance',
} as const;

export const GROUPES_LOYERS_TEXTES: Readonly<Record<GroupeLoyer, string>> = {
  en_retard: 'En retard',
  partiel: 'Partiels',
  attendu: 'Attendus',
  recu: 'Reçus',
};

/** « Julie Martin », « Julie Martin et Léa Bernard », « Julie Martin, Léa Bernard et Hugo Petit ». */
export function nomsDesLocataires(noms: readonly string[]): string {
  const [dernier, ...avant] = [...noms].reverse();
  if (dernier === undefined) return '';
  return avant.length === 0 ? dernier : `${avant.reverse().join(', ')} et ${dernier}`;
}

/** « Coloc Rouet · Chambre 2 » pour une location à la chambre ; le nom seul pour le bien entier. */
export function bienEtChambre(nom: string, libelle: string | undefined): string {
  return libelle === undefined ? nom : `${nom} · ${libelle}`;
}

/** 30 000 centimes → « Paiement de 300 € enregistré. » (bandeau qui propose « Annuler »). */
export function paiementEnregistre(centimes: number): string {
  return `Paiement de ${montant(centimes)} enregistré.`;
}

/** 40 000 centimes → « 400 € restent ». */
export function resteAPayer(centimes: number): string {
  return `${montant(centimes)} restent`;
}

/** 30 000 centimes → « Reçu de 300 € » (le bouton qui ouvre le reçu d'un paiement partiel). */
/** « + 180 € d’APL » sous la part du locataire, quand la CAF verse l’aide au bailleur. */
export function plusApl(centimes: number): string {
  return `+ ${montant(centimes)} d’APL`;
}

export function recuDe(centimes: number): string {
  return `Reçu de ${montant(centimes)}`;
}

export const ERREURS_EN_PARTIE: Readonly<Record<ChampEnPartie, string>> = {
  montant: 'Indique un montant d’au moins 0,01 €, sans dépasser ce qui reste dû.',
  date: 'Indique la date du paiement : aujourd’hui ou avant.',
};
