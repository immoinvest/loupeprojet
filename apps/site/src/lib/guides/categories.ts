/** Les catégories des guides : adresse `/guides/<slug>/`, nom court, titre et description pour Google. */

export const SLUGS_CATEGORIES = [
  'investir',
  'trouver-un-bien',
  'fiscalite',
  'gerer-ses-locataires',
] as const;

export type SlugCategorie = (typeof SLUGS_CATEGORIES)[number];

export interface Categorie {
  readonly slug: SlugCategorie;
  readonly nom: string;
  readonly titre: string;
  readonly description: string;
}

export const CATEGORIES: Readonly<Record<SlugCategorie, Categorie>> = {
  investir: {
    slug: 'investir',
    nom: 'Investir',
    titre: 'Investissement locatif : les guides pour bien démarrer',
    description:
      'Premier achat, rentabilité, cash-flow, crédit : les guides Deklic pour préparer un investissement locatif en France, chiffres et sources à l’appui.',
  },
  'trouver-un-bien': {
    slug: 'trouver-un-bien',
    nom: 'Trouver un bien rentable',
    titre: 'Trouver un bien rentable : méthodes et critères',
    description:
      'Où chercher, quels critères regarder, comment vérifier le prix d’une annonce avec les ventes réelles : les guides pour repérer un bien rentable.',
  },
  fiscalite: {
    slug: 'fiscalite',
    nom: 'Fiscalité',
    titre: 'Fiscalité de la location : LMNP, location nue et revente',
    description:
      'Micro-BIC, LMNP au réel, micro-foncier, déficit foncier, plus-value : les régimes fiscaux de la location expliqués avec les règles en vigueur.',
  },
  'gerer-ses-locataires': {
    slug: 'gerer-ses-locataires',
    nom: 'Gérer ses locataires',
    titre: 'Gérer ses locataires : loyers, quittances et impayés',
    description:
      'Quittances, loyers impayés, révision du loyer : les guides pour gérer une location au quotidien, étape par étape et selon la loi.',
  },
};

/** Les catégories dans l'ordre d'affichage. */
export const LISTE_CATEGORIES: readonly Categorie[] = SLUGS_CATEGORIES.map(
  (slug) => CATEGORIES[slug],
);
