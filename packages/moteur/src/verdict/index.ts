import { prixRetenu } from '../achat';
import type { EstimationPrix } from '../estimation';
import type { ResultatFinancement } from '../financement';
import type { ResultatFiscalite } from '../fiscalite/types';
import type { Regles } from '../regles/types';
import type { ResultatRendement } from '../rendement';
import type { Projet } from '../schema/projet';
import {
  feuCashflow,
  feuCouverture,
  feuPrix,
  feuRendement,
  feuRisques,
  type Feu,
  type FeuVerdict,
} from './feux';
import { pointsDeVigilance, type PointVigilance } from './vigilance';

export interface SyntheseVerdict {
  readonly bons: number;
  readonly surveiller: number;
  readonly problemes: number;
  readonly inconnus: number;
}

export interface ResultatVerdict {
  /** Toujours cinq, dans l'ordre : prix, rendement, cash-flow, couverture, risques. */
  readonly feux: readonly FeuVerdict[];
  readonly synthese: SyntheseVerdict;
  readonly vigilance: readonly PointVigilance[];
}

function compter(feux: readonly FeuVerdict[], feu: Feu): number {
  return feux.filter((f) => f.feu === feu).length;
}

export function calculerVerdict(
  projet: Projet,
  financement: ResultatFinancement,
  fiscalite: ResultatFiscalite,
  rendement: ResultatRendement,
  regles: Regles,
  estimation: EstimationPrix | null = null,
): ResultatVerdict {
  const retenu = fiscalite.regimes[fiscalite.retenu];
  const prix = feuPrix(
    prixRetenu(projet.hypotheses.achat) / projet.bien.surface,
    projet.marche,
    regles,
    estimation?.prixM2Estime ?? null,
  );
  const feux: readonly FeuVerdict[] = [
    prix,
    feuRendement(rendement.rendements.net, regles),
    feuCashflow(retenu.cashflow.mensuel, regles),
    feuCouverture(retenu.cashflow.tauxCouverture, regles),
    feuRisques(projet.bien, projet.marche),
  ];
  return {
    feux,
    synthese: {
      bons: compter(feux, 'bon'),
      surveiller: compter(feux, 'surveiller'),
      problemes: compter(feux, 'probleme'),
      inconnus: compter(feux, 'inconnu'),
    },
    vigilance: pointsDeVigilance(projet, financement, fiscalite),
  };
}

export {
  feuCashflow,
  feuCouverture,
  feuPrix,
  feuRendement,
  feuRisques,
  type AxeVerdict,
  type Feu,
  type FeuVerdict,
} from './feux';
export { pointsDeVigilance, type CodeVigilance, type PointVigilance } from './vigilance';
