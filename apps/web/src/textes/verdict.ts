import type { AxeVerdict, Resultats } from '@loupe/moteur';

import { euros, eurosSignes, pourcentage, pourcentageSigne } from '@/formatage/nombres';

import { TEXTES_A_COMPLETER } from './manques';

export interface TexteVerdict {
  readonly titre: string;
  readonly sousTitre: string;
}

/** État d'un feu en texte libre : les `switch` gardent un `default` pour l'inconnu. */
interface EtatFeu {
  readonly etat: string;
  readonly valeur: number | null;
}

/** Le verdict porte toujours les cinq axes : on lit l'état sans cas d'absence. */
function feu(r: Resultats, axe: AxeVerdict): EtatFeu {
  let lu: EtatFeu = { etat: 'inconnu', valeur: null };
  for (const f of r.verdict.feux) {
    if (f.axe === axe) lu = { etat: f.feu, valeur: f.valeur };
  }
  return lu;
}

function phrasePrix(r: Resultats): string {
  switch (feu(r, 'prix').etat) {
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
  switch (feu(r, 'cashflow').etat) {
    case 'bon':
      return 'Le loyer couvre tout.';
    case 'surveiller':
      return 'Le loyer couvre presque tout.';
    default:
      return 'Le loyer ne couvre pas tout.';
  }
}

/** Titre en deux phrases courtes et sous-titre chiffré, composés par règles. */
export function texteVerdict(r: Resultats): TexteVerdict {
  const morceaux: string[] = [];
  const prix = feu(r, 'prix');
  if (prix.valeur !== null) {
    morceaux.push(`${pourcentageSigne(prix.valeur)} par rapport au prix estimé`);
  }
  const couverture = feu(r, 'couverture');
  if (couverture.valeur !== null) {
    morceaux.push(
      couverture.etat === 'probleme'
        ? `le crédit dépasse le loyer (${pourcentage(couverture.valeur, 0)})`
        : `le crédit prend ${pourcentage(couverture.valeur, 0)} du loyer`,
    );
  }
  if (r.complet) {
    const cf = r.cashflow.mensuel;
    morceaux.push(
      cf < 0
        ? `${euros(Math.abs(cf))} à sortir chaque mois`
        : `${eurosSignes(cf)} par mois dans la poche`,
    );
  }
  return {
    titre: `${phrasePrix(r)} ${phraseCashflow(r)}`,
    sousTitre: morceaux.length === 0 ? TEXTES_A_COMPLETER.sousTitreSeul : `${morceaux.join(', ')}.`,
  };
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
