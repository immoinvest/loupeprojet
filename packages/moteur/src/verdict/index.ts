import type { EstimationPrix } from '../estimation';
import type { ResultatFinancement } from '../financement';
import type { ResultatFiscalite } from '../fiscalite/types';
import type { Regles } from '../regles/types';
import type { ResultatRendement } from '../rendement';
import { manquesDe, raisonParmi, type Manque } from '../schema/manques';
import type { Projet } from '../schema/projet';
import {
  feuCashflow,
  feuEffort,
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
  /** Toujours cinq, dans l'ordre : prix, rendement, cash-flow, effort, risques. */
  readonly feux: readonly FeuVerdict[];
  readonly synthese: SyntheseVerdict;
  readonly vigilance: readonly PointVigilance[];
}

function compter(feux: readonly FeuVerdict[], feu: Feu): number {
  return feux.filter((f) => f.feu === feu).length;
}

export interface OptionsVerdict {
  readonly estimation?: EstimationPrix | null;
  /** Données absentes du projet (défaut : lues dans le projet). */
  readonly manques?: readonly Manque[];
}

export function calculerVerdict(
  projet: Projet,
  financement: ResultatFinancement,
  fiscalite: ResultatFiscalite,
  rendement: ResultatRendement,
  regles: Regles,
  options: OptionsVerdict = {},
): ResultatVerdict {
  const estimation = options.estimation ?? null;
  const manques = options.manques ?? manquesDe(projet);
  const retenu = fiscalite.regimes[fiscalite.retenu];
  const prix = feuPrix(
    projet.hypotheses.achat.prix / projet.bien.surface,
    projet.marche,
    regles,
    estimation?.prixM2Estime ?? null,
  );
  const feux: readonly FeuVerdict[] = [
    prix,
    feuRendement(rendement.rendements.net, regles),
    feuCashflow(retenu.cashflow.mensuel, regles),
    feuEffort(
      financement.effort,
      regles,
      raisonParmi(manques, ['LOYER_ABSENT', 'REVENUS_ABSENTS']),
    ),
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
    vigilance: pointsDeVigilance(projet, financement, fiscalite, prix, regles),
  };
}

export {
  feuCashflow,
  feuEffort,
  feuPrix,
  feuRendement,
  feuRisques,
  type AxeVerdict,
  type Feu,
  type FeuVerdict,
} from './feux';
export { pointsDeVigilance, type CodeVigilance, type PointVigilance } from './vigilance';
