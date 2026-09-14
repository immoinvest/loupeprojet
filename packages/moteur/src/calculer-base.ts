import type { ResultatCashflow } from './cashflow';
import { estimerPrix, type EstimationPrix } from './estimation';
import { calculerFinancement, type ResultatFinancement } from './financement';
import { calculerFiscalite, type ResultatFiscalite } from './fiscalite';
import type { Regles } from './regles/types';
import { calculerRendement, type ResultatRendement } from './rendement';
import { calculerRevente, type ResultatRevente } from './revente';
import { manquesDe, type Manque } from './schema/manques';
import type { Projet } from './schema/projet';
import { calculerVerdict, type ResultatVerdict } from './verdict';

/** Tout le rapport sauf les scénarios (qui recalculent une base par variante). */
export interface ResultatsBase {
  readonly projet: Projet;
  readonly financement: ResultatFinancement;
  /** Cash-flow du régime retenu. */
  readonly cashflow: ResultatCashflow;
  readonly fiscalite: ResultatFiscalite;
  readonly revente: ResultatRevente;
  readonly rendement: ResultatRendement;
  /** Estimation du prix du bien ; `null` sans ventes réelles connues. */
  readonly estimation: EstimationPrix | null;
  readonly verdict: ResultatVerdict;
  /** Données sans défaut que le projet ne donne pas ; l'interface sait quoi demander. */
  readonly manques: readonly Manque[];
}

/** Enchaîne les modules dans l'ordre de leurs dépendances. Le projet est supposé déjà validé. */
export function calculerBase(projet: Projet, regles: Regles): ResultatsBase {
  const manques = manquesDe(projet);
  const financement = calculerFinancement(projet, regles);
  const fiscalite = calculerFiscalite(projet, financement, regles);
  const revente = calculerRevente(projet, financement, fiscalite, regles);
  const rendement = calculerRendement(projet, financement, fiscalite, revente);
  const estimation = estimerPrix(projet, regles);
  const verdict = calculerVerdict(projet, financement, fiscalite, rendement, regles, {
    estimation,
    manques,
  });
  return {
    projet,
    financement,
    cashflow: fiscalite.regimes[fiscalite.retenu].cashflow,
    fiscalite,
    revente,
    rendement,
    estimation,
    verdict,
    manques,
  };
}
