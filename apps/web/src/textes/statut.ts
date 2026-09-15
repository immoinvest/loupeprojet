import type { StatutProjet } from '@/stockage/projets';

/** Nom de la liste du statut, dans l'en-tête d'un projet. */
export const TEXTES_STATUT = {
  libelle: 'Statut du projet',
} as const;

/**
 * Ordre d'affichage du menu : le parcours d'achat, puis, séparés, les « à côté ». L'ordre du schéma
 * Zod ne change pas.
 */
export const ORDRE_STATUTS: readonly {
  readonly nom: string;
  readonly statuts: readonly StatutProjet[];
}[] = [
  { nom: 'Le parcours d’achat', statuts: ['analyse', 'visite', 'offre', 'achete'] },
  { nom: 'À côté', statuts: ['scenario', 'ecarte'] },
];

/** Courte précision grise des statuts hors parcours. */
export const PRECISIONS_STATUT: Readonly<Partial<Record<StatutProjet, string>>> = {
  scenario: 'pour comparer',
  ecarte: 'on n’y va pas',
};
