import type { CodeErreurFinBail } from '@/gestion/fin-bail/types';

/** Textes de la fin du bail : préavis, dépôt de garantie, charges, colocataires (tutoiement). */

export const TEXTES_FIN_BAIL = {
  chargement: 'Chargement…',
  indisponible: 'Bientôt disponible : le préavis, le dépôt et les charges arrivent dans Gérer.',
} as const;

export const ERREURS_FIN_BAIL: Readonly<Record<CodeErreurFinBail, string>> = {
  non_connecte: 'Ta session a expiré. Reconnecte-toi.',
  invalide: 'Une information est invalide. Vérifie les champs.',
  introuvable: 'Cet élément n’existe plus. Recharge la page.',
  date_invalide: 'Cette date ne convient pas : elle est dans le futur, ou hors du bail.',
  conge_invalide: 'Un congé ne peut pas être reçu avant l’entrée du locataire.',
  fin_avant_entree: 'La sortie ne peut pas précéder l’entrée.',
  paiements_apres_sortie:
    'Des loyers sont déjà reçus pour des mois après cette sortie : annule-les d’abord.',
  location_en_cours: 'Le dépôt se rend après la sortie : enregistre d’abord le départ.',
  retenues_trop_elevees: 'Les retenues dépassent le dépôt de garantie.',
  deja_enregistre: 'C’est déjà enregistré. Recharge la page.',
  depot_rendu: 'Le dépôt est déjà rendu : le décompte ne s’annule plus.',
  regularisation_impossible: 'Rien à régulariser pour cette année. Recharge la page.',
  colocataire_refuse: 'Ce changement n’est pas possible à cette date.',
  bailleur_manquant: 'Indique d’abord ton nom et ton adresse de bailleur.',
  limite: 'Cette location a atteint dix colocataires.',
  indisponible: TEXTES_FIN_BAIL.indisponible,
  reseau: 'Impossible de joindre Deklic. Vérifie ta connexion internet.',
  inconnue: 'Quelque chose n’a pas marché. Réessaie.',
};
