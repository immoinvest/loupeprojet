import type { ResultatsBase } from '../calculer-base';
import type { Projet } from '../schema/projet';
import { QUESTIONS_DIAGNOSTICS } from './base/diagnostics';
import { QUESTIONS_DOCUMENTS } from './base/documents';
import { QUESTIONS_EXPLOITATION } from './base/exploitation';
import { QUESTIONS_IMMEUBLE } from './base/immeuble';
import { QUESTIONS_LOGEMENT } from './base/logement';
import { QUESTIONS_QUARTIER } from './base/quartier';
import { QUESTIONS_VENDEUR } from './base/vendeur';
import { contexteVisite } from './contexte';
import type { ContexteVisite, QuestionPosee, QuestionVisite } from './types';

/** Date de la dernière révision de la base (ajout, retrait ou reformulation d'une question). */
export const VERSION_QUESTIONS_VISITE = '2026-09-14';

/**
 * La base complète, dans l'ordre d'affichage : listes publiques (ANIL, Notaires de France,
 * Service-public.fr), textes (loi ALUR, loi Climat et résilience, loi Le Meur, décrets) et
 * usages Deklic. Chaque question cite sa source.
 */
export const QUESTIONS_VISITE: readonly QuestionVisite[] = [
  ...QUESTIONS_DOCUMENTS,
  ...QUESTIONS_DIAGNOSTICS,
  ...QUESTIONS_LOGEMENT,
  ...QUESTIONS_IMMEUBLE,
  ...QUESTIONS_QUARTIER,
  ...QUESTIONS_VENDEUR,
  ...QUESTIONS_EXPLOITATION,
];

/** Les questions dont la condition est vraie dans ce contexte, avec leurs paramètres. */
export function questionsPourContexte(contexte: ContexteVisite): readonly QuestionPosee[] {
  return QUESTIONS_VISITE.filter((q) => q.condition === undefined || q.condition(contexte)).map(
    (q) => ({
      id: q.id,
      categorie: q.categorie,
      texte: q.texte,
      source: q.source,
      parametres: q.parametres?.(contexte) ?? {},
      ...(q.valeur === undefined ? {} : { valeur: q.valeur }),
    }),
  );
}

/**
 * La liste de visite d'un projet : pure, même entrée même sortie. Les résultats ne servent
 * qu'aux feux (prix sous ou au-dessus du marché).
 */
export function questionsPourProjet(
  projet: Projet,
  resultats: Pick<ResultatsBase, 'verdict'>,
): readonly QuestionPosee[] {
  return questionsPourContexte(contexteVisite(projet, resultats.verdict.feux));
}
