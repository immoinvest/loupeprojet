import type { TypeIndicateurLoyer } from '../../schemas/loyers.ts';
import type { Source } from '../../schemas/meta.ts';

/** Millésime du jeu ANIL ; un nouveau jeu (nouveau slug data.gouv) paraît chaque fin d'année : mettre à jour les quatre URL. */
export const MILLESIME_LOYERS = '2025';

export const SOURCE_LOYERS: Source = {
  nom: "Carte des loyers : indicateurs de loyers d'annonce par commune en 2025 (ANIL, DHUP)",
  url: 'https://www.data.gouv.fr/datasets/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025',
  licence: 'Réutilisation libre sous réserve de la mention de source imposée par l’ANIL',
  mention: 'Estimations ANIL, à partir des données du Groupe SeLoger et de leboncoin',
};

/** Ressources data.gouv par identifiant stable (redirigées vers la dernière version du fichier). */
export const FICHIERS_LOYERS: Readonly<Record<TypeIndicateurLoyer, string>> = {
  appartement: 'https://www.data.gouv.fr/fr/datasets/r/55b34088-0964-415f-9df7-d87dd98a09be',
  appartementT1T2: 'https://www.data.gouv.fr/fr/datasets/r/14a1fe11-b2d1-49b3-9f6b-83d12df9482c',
  appartementT3Plus: 'https://www.data.gouv.fr/fr/datasets/r/5e3b28a4-cf56-43a3-ae79-43cceeb27f8c',
  maison: 'https://www.data.gouv.fr/fr/datasets/r/129f764d-b613-44e4-952c-5ff50a8c9b73',
};
