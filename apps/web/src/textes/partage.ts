/** Pourquoi un lien de partage n'a pas pu être lu, en une phrase. */
export const RAISONS_PARTAGE = {
  vide: 'Ce lien ne contient aucun projet. Demandez à la personne qui vous l’a envoyé de le copier à nouveau depuis le bouton Partager.',
  illisible:
    'Ce lien est incomplet ou abîmé, sans doute coupé en le collant. Demandez-en un nouveau.',
  invalide:
    'Ce projet vient d’une version de Deklic que celle-ci ne sait pas lire. Demandez un nouveau lien.',
} as const;

export type RaisonPartage = keyof typeof RAISONS_PARTAGE;
