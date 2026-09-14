import { resumerAchat, type ResumeAchat } from './achat';
import type { ResultatCashflow } from './cashflow';
import { estimerPrix, type EstimationPrix } from './estimation';
import { calculerFinancement, type ResultatFinancement } from './financement';
import { calculerFiscalite, type ResultatFiscalite } from './fiscalite';
import type { Regles } from './regles/types';
import { calculerRendement, type ResultatRendement } from './rendement';
import { calculerRevente, type ResultatRevente } from './revente';
import type { Projet } from './schema/projet';
import { calculerVerdict, type ResultatVerdict } from './verdict';

/** Tout le rapport sauf les scénarios (qui recalculent une base par variante). */
export interface ResultatsBase {
  readonly projet: Projet;
  /** Prix affiché, prix retenu après négociation, écart : le prix sur lequel tout est calculé. */
  readonly achat: ResumeAchat;
  readonly financement: ResultatFinancement;
  /** Cash-flow du régime retenu. */
  readonly cashflow: ResultatCashflow;
  readonly fiscalite: ResultatFiscalite;
  readonly revente: ResultatRevente;
  readonly rendement: ResultatRendement;
  /** Estimation du prix du bien ; `null` sans ventes réelles connues. */
  readonly estimation: EstimationPrix | null;
  readonly verdict: ResultatVerdict;
}

/** Enchaîne les modules dans l'ordre de leurs dépendances. Le projet est supposé déjà validé. */
export function calculerBase(projet: Projet, regles: Regles): ResultatsBase {
  const financement = calculerFinancement(projet, regles);
  const fiscalite = calculerFiscalite(projet, financement, regles);
  const revente = calculerRevente(projet, financement, fiscalite, regles);
  const rendement = calculerRendement(projet, financement, fiscalite, revente);
  const estimation = estimerPrix(projet, regles);
  const verdict = calculerVerdict(projet, financement, fiscalite, rendement, regles, estimation);
  return {
    projet,
    achat: resumerAchat(projet.hypotheses.achat),
    financement,
    cashflow: fiscalite.regimes[fiscalite.retenu].cashflow,
    fiscalite,
    revente,
    rendement,
    estimation,
    verdict,
  };
}
