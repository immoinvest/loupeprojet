/** Textes de la carte « Ton identité de bailleur », demandée une seule fois, à la première quittance. */
export const TEXTES_BAILLEUR = {
  titre: 'Ton nom et ton adresse sur les quittances',
  phrase: 'Deklic les écrit sur chaque quittance et chaque reçu. On ne te les demande qu’une fois.',
  nom: 'Ton nom, tel qu’il figure sur le bail',
  adresse: 'Ton adresse',
  enregistrer: 'Enregistrer et ouvrir',
  annuler: 'Annuler',
} as const;

export type ChampBailleur = 'nom' | 'adresse';

export const ERREURS_BAILLEUR: Readonly<Record<ChampBailleur, string>> = {
  nom: 'Indique ton nom (120 caractères au plus).',
  adresse: 'Indique ton adresse (300 caractères au plus).',
};
