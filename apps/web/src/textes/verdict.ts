import type { AxeVerdict, Resultats } from '@loupe/moteur';

import { TEXTES_A_COMPLETER } from './manques';

export interface TexteVerdict {
  readonly titre: string;
}

/** État d'un feu en texte libre : les `switch` gardent un `default` pour l'inconnu. */
function etatFeu(r: Resultats, axe: AxeVerdict): string {
  let etat = 'inconnu';
  for (const f of r.verdict.feux) {
    if (f.axe === axe) etat = f.feu;
  }
  return etat;
}

function phrasePrix(r: Resultats): string {
  switch (etatFeu(r, 'prix')) {
    case 'bon':
      return 'Le prix est bon.';
    case 'surveiller':
      return 'Le prix est dans le marché.';
    case 'probleme':
      return 'Le prix est élevé.';
    default:
      return 'Prix sans repère de marché.';
  }
}

/** Sans loyer, le cash-flow n'est pas calculé : la phrase le dit au lieu de conclure. */
function phraseCashflow(r: Resultats): string {
  if (!r.complet) return TEXTES_A_COMPLETER.verdictCashflow;
  switch (etatFeu(r, 'cashflow')) {
    case 'bon':
      return 'Le loyer couvre tout.';
    case 'surveiller':
      return 'Le loyer couvre presque tout.';
    default:
      return 'Le loyer ne couvre pas tout.';
  }
}

/** Titre en deux phrases courtes, composé par règles ; les chiffres sont dans les feux. */
export function texteVerdict(r: Resultats): TexteVerdict {
  return { titre: `${phrasePrix(r)} ${phraseCashflow(r)}` };
}

/** Réponse courte d'une carte-question. */
export function reponseCourte(etat: 'oui' | 'presque' | 'non'): string {
  switch (etat) {
    case 'oui':
      return 'Oui.';
    case 'presque':
      return 'Pas tout à fait.';
    case 'non':
      return 'Non.';
  }
}
