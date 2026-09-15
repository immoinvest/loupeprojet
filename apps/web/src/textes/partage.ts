/** Pourquoi un lien de partage n'a pas pu être lu, en une phrase. */
export const RAISONS_PARTAGE = {
  vide: 'Ce lien ne contient aucun projet. Demandez à la personne qui vous l’a envoyé de le copier à nouveau depuis le bouton Partager.',
  illisible:
    'Ce lien est incomplet ou abîmé, sans doute coupé en le collant. Demandez-en un nouveau.',
  invalide:
    'Ce projet vient d’une version de Deklic que celle-ci ne sait pas lire. Demandez un nouveau lien.',
} as const;

export type RaisonPartage = keyof typeof RAISONS_PARTAGE;

/** Pourquoi un lien court ne s'ouvre pas, en une phrase. */
export const RAISONS_PARTAGE_COURT = {
  introuvable:
    'Ce lien a expiré ou la personne qui vous l’a envoyé a arrêté le partage. Demandez-en un nouveau.',
  indisponible:
    'Impossible d’ouvrir ce lien pour l’instant : vérifiez votre connexion, puis rechargez la page.',
} as const;

/** Infobulle du bouton Partager : le lien donne le projet, apport et tranche d'imposition compris. */
export const AVERTISSEMENT_PARTAGE =
  "Crée un lien vers une copie du projet (sans la visite), apport et tranche d'imposition compris, gardée 90 jours après sa dernière ouverture. Ne le donnez qu'à des personnes de confiance.";

/** Partager un projet : une boîte montre le lien déjà copié ; au doigt, la feuille de partage en plus. */
export const TEXTES_PARTAGE_PROJET = {
  partager: 'Partager',
  titre: 'Partager ce projet',
  lien: 'Lien de partage',
  copier: 'Copier le lien',
  copie: 'Lien copié',
  copieRefusee: 'Le navigateur n’a pas pu le copier : sélectionnez le lien pour le copier.',
  envoyer: 'Envoyer',
  partage: 'Lien partagé',
  fermer: 'Fermer',
  preparation: 'Préparation du lien…',
  avertissement:
    "Une copie du projet, sans la visite, apport et tranche d'imposition compris, est gardée 90 jours après sa dernière ouverture.",
  avertissementLong:
    "Lien long : le lien court n'est pas disponible pour l'instant. Il contient le projet sans la visite, apport et tranche d'imposition compris.",
  arreter: 'Arrêter le partage',
  arrete: 'Partage arrêté : ce lien ne s’ouvre plus.',
  arretImpossible: 'Le partage n’a pas pu être arrêté. Réessayez plus tard.',
  chargement: 'Ouverture du projet partagé…',
  message: (nom: string): string => `Mon projet « ${nom} » sur Deklic.`,
} as const;
