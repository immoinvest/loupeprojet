import type { AxeVerdict, Feu, FeuVerdict } from '@loupe/moteur';

import { eurosParMois, pourcentage, pourcentageSigne } from '@/formatage/nombres';

export const AXES: Readonly<Record<AxeVerdict, string>> = {
  prix: 'Prix vs ventes réelles',
  rendement: 'Rendement net',
  cashflow: 'Cash-flow',
  effort: 'Effort bancaire',
  risques: 'Risques',
};

export const ETATS: Readonly<Record<Feu, string>> = {
  bon: 'bon',
  surveiller: 'à surveiller',
  probleme: 'problème',
  inconnu: 'inconnu',
};

/** « aucun », « 1 signal », « 2 signaux ». */
export function libelleRisques(nombre: number): string {
  if (nombre === 0) return 'aucun';
  return `${String(nombre)} ${nombre === 1 ? 'signal' : 'signaux'}`;
}

/** Texte court d'une pastille de feu : « Prix −22 % », « Cash-flow −210 €/mois »… */
export function libelleFeu(feu: FeuVerdict): string {
  if (feu.valeur === null) return `${AXES[feu.axe]} : pas de données`;
  switch (feu.axe) {
    case 'prix':
      return `Prix ${pourcentageSigne(feu.valeur)}`;
    case 'rendement':
      return `Rendement net ${pourcentage(feu.valeur)}`;
    case 'cashflow':
      return `Cash-flow ${eurosParMois(feu.valeur)}`;
    case 'effort':
      return `Effort ${pourcentage(feu.valeur, 0)}`;
    case 'risques':
      return `Risques : ${libelleRisques(feu.valeur)}`;
  }
}
