import type { Source } from '../../schemas/meta.ts';

export const SOURCE_ZONAGE: Source = {
  nom: 'Liste des communes selon le zonage ABC (Ministère de la Transition écologique)',
  url: 'https://www.data.gouv.fr/datasets/liste-des-communes-selon-le-zonage-abc',
  licence: 'Licence Ouverte 2.0',
};

/** Métadonnées du jeu sur data.gouv : la ressource « ensemble des communes » change d'identifiant à chaque arrêté. */
export const API_JEU_ZONAGE =
  'https://www.data.gouv.fr/api/1/datasets/liste-des-communes-selon-le-zonage-abc/';

/** Texte présent dans le titre de la ressource nationale, quelle que soit la révision. */
export const MARQUE_RESSOURCE_NATIONALE = 'ensemble des communes';
