import { prixRetenu } from '../achat';
import type { EstimationPrix } from '../estimation';
import type { ResultatFinancement } from '../financement';
import type { ResultatFiscalite } from '../fiscalite/types';
import type { Regles } from '../regles/types';
import type { ResultatRendement } from '../rendement';
import { manquesDe, raisonParmi, type Manque } from '../schema/manques';
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

export interface OptionsVerdict {
  readonly estimation?: EstimationPrix | null;
  /** Données absentes du projet (défaut : lues dans le projet). */
  readonly manques?: readonly Manque[];
}

/**
 * Les cinq feux et les points de vigilance. Fiscalité et rendement sont `null` quand le loyer manque :
 * les feux rendement, cash-flow et couverture sont alors « inconnu » avec cette raison.
 */
export function calculerVerdict(
  projet: Projet,
  financement: ResultatFinancement,
  fiscalite: ResultatFiscalite | null,
  rendement: ResultatRendement | null,
  regles: Regles,
  options: OptionsVerdict = {},
): ResultatVerdict {
  const estimation = options.estimation ?? null;
  const manques = options.manques ?? manquesDe(projet);
  const raisonLoyer = raisonParmi(manques, ['LOYER_ABSENT']);
  const retenu = fiscalite === null ? null : fiscalite.regimes[fiscalite.retenu];
  const prix = feuPrix(
    prixRetenu(projet.hypotheses.achat) / projet.bien.surface,
    projet.marche,
    regles,
    estimation?.prixM2Estime ?? null,
  );
  const feux: readonly FeuVerdict[] = [
    prix,
    feuRendement(rendement === null ? null : rendement.rendements.net, regles, raisonLoyer),
    feuCashflow(retenu === null ? null : retenu.cashflow.mensuel, regles, raisonLoyer),
    feuCouverture(retenu === null ? null : retenu.cashflow.tauxCouverture, regles, raisonLoyer),
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
