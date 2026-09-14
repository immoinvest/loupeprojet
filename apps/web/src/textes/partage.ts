/** Pourquoi un lien de partage n'a pas pu être lu, en une phrase. */
export const RAISONS_PARTAGE = {
  vide: 'Ce lien ne contient aucun projet. Demandez à la personne qui vous l’a envoyé de le copier à nouveau depuis le bouton Partager.',
  illisible:
    'Ce lien est incomplet ou abîmé, sans doute coupé en le collant. Demandez-en un nouveau.',
  invalide:
    'Ce projet vient d’une version de Deklic que celle-ci ne sait pas lire. Demandez un nouveau lien.',
} as const;

export type RaisonPartage = keyof typeof RAISONS_PARTAGE;

/** Infobulle du bouton Partager : le lien porte tout le projet, données personnelles comprises. */
export const AVERTISSEMENT_PARTAGE =
  "Copie un lien qui contient tout le projet, revenus et apport compris. Il n'est jamais envoyé à nos serveurs : ne le donnez qu'à des personnes de confiance.";

/** Partager un projet : feuille de partage au doigt, lien copié à la souris. */
export const TEXTES_PARTAGE_PROJET = {
  partager: 'Partager',
  copie: 'Lien copié',
  partage: 'Lien partagé',
  avertissement: 'Il contient tout le projet, revenus et apport compris.',
  message: (nom: string): string => `Mon projet « ${nom} » sur Deklic.`,
} as const;
