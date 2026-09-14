import { CATEGORIES_VISITE, type CategorieVisite, type QuestionPosee } from '@loupe/moteur';

import { descripteurParChemin, type Descripteur } from '@/hypotheses';

export interface GroupeQuestions {
  readonly categorie: CategorieVisite;
  readonly questions: readonly QuestionPosee[];
}

/** Les questions posées, par catégorie dans l'ordre des sept groupes ; les groupes vides disparaissent. */
export function grouperParCategorie(
  questions: readonly QuestionPosee[],
): readonly GroupeQuestions[] {
  return CATEGORIES_VISITE.map((categorie) => ({
    categorie,
    questions: questions.filter((q) => q.categorie === categorie),
  })).filter((g) => g.questions.length > 0);
}

/**
 * Le descripteur de l'onglet Hypothèses qui écrit la valeur d'une question (libellé, unité,
 * options, conversion) ; `null` pour une question sans valeur.
 */
export function descripteurDeValeur(question: QuestionPosee): Descripteur | null {
  return question.valeur === undefined ? null : descripteurParChemin(question.valeur.chemin);
}
