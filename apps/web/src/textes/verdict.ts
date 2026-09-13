import type { Resultats } from '@loupe/moteur';

import { euros, eurosSignes, pourcentage, pourcentageSigne } from '@/formatage/nombres';

export interface TexteVerdict {
  readonly titre: string;
  readonly sousTitre: string;
}

function feu(r: Resultats, axe: 'prix' | 'cashflow' | 'effort'): string {
  return r.verdict.feux.find((f) => f.axe === axe)?.feu ?? 'inconnu';
}

function phrasePrix(r: Resultats): string {
  switch (feu(r, 'prix')) {
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

function phraseCashflow(r: Resultats): string {
  switch (feu(r, 'cashflow')) {
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
  const prix = r.verdict.feux.find((f) => f.axe === 'prix');
  const morceaux: string[] = [];
  if (prix?.valeur !== null && prix?.valeur !== undefined) {
    morceaux.push(`${pourcentageSigne(prix.valeur)} par rapport aux ventes du quartier`);
  }
  const effort = r.financement.effort.hcsf;
  if (effort !== null) {
    morceaux.push(
      feu(r, 'effort') === 'probleme'
        ? `effort bancaire de ${pourcentage(effort, 0)}, au-dessus du seuil`
        : `banque d'accord (effort ${pourcentage(effort, 0)})`,
    );
  }
  const cf = r.cashflow.mensuel;
  morceaux.push(
    cf < 0
      ? `${euros(Math.abs(cf))} à sortir chaque mois`
      : `${eurosSignes(cf)} par mois dans la poche`,
  );
  return {
    titre: `${phrasePrix(r)} ${phraseCashflow(r)}`,
    sousTitre: `${morceaux.join(', ')}.`,
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
