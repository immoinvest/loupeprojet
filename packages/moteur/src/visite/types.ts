import type { Regles } from '../regles/types';
import type { Projet } from '../schema/projet';
import type { FeuVerdict } from '../verdict/feux';

/** Les sept groupes de la liste de visite, dans l'ordre d'affichage. */
export const CATEGORIES_VISITE = [
  'documents',
  'diagnostics',
  'logement',
  'immeuble',
  'quartier',
  'vendeur',
  'exploitation',
] as const;
export type CategorieVisite = (typeof CATEGORIES_VISITE)[number];

/**
 * Types d'exploitation d'un investisseur (fiche 05). Aujourd'hui le mode du projet n'en connaît
 * que trois ; colocation et moyenne durée sont prêts pour la suite.
 */
export const TYPES_EXPLOITATION = [
  'nue',
  'meublee',
  'colocation',
  'courte_duree',
  'moyenne_duree',
] as const;
export type TypeExploitation = (typeof TYPES_EXPLOITATION)[number];

/** Ce que les conditions et les paramètres des questions peuvent lire. */
export interface ContexteVisite {
  readonly projet: Projet;
  readonly exploitation: TypeExploitation;
  /** Les cinq feux du verdict. */
  readonly feux: readonly FeuVerdict[];
  readonly regles: Regles;
  /** Année de la date de référence des règles : sert à l'âge des installations. */
  readonly anneeReference: number;
}

export type PredicatVisite = (contexte: ContexteVisite) => boolean;

/** Valeurs brutes (nombres, codes) que l'interface formate dans le texte de la question. */
export type ParametresQuestion = Readonly<Record<string, number | string>>;

export type TypeValeurQuestion = 'euros' | 'entier' | 'nombre' | 'enum';

/** Une question « à valeur » : la réponse écrit une hypothèse du projet, par son chemin. */
export interface ValeurQuestion {
  readonly chemin: string;
  readonly type: TypeValeurQuestion;
}

/** Une question de la base, versionnée avec sa source. */
export interface QuestionVisite {
  readonly id: string;
  readonly categorie: CategorieVisite;
  /** Texte de la question ; `{nom}` est remplacé par le paramètre du même nom, formaté par l'interface. */
  readonly texte: string;
  /** Liste publique ou texte dont la question est tirée. */
  readonly source: string;
  /** Absente : la question est posée pour tout projet. */
  readonly condition?: PredicatVisite;
  readonly parametres?: (contexte: ContexteVisite) => ParametresQuestion;
  readonly valeur?: ValeurQuestion;
}

/** Une question retenue pour un projet, avec ses paramètres calculés. */
export interface QuestionPosee {
  readonly id: string;
  readonly categorie: CategorieVisite;
  readonly texte: string;
  readonly source: string;
  readonly parametres: ParametresQuestion;
  readonly valeur?: ValeurQuestion;
}
