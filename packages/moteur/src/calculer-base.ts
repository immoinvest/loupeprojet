import type { ResultatCashflow } from './cashflow';
import { estimerPrix, type EstimationPrix } from './estimation';
import { calculerFinancement, type ResultatFinancement } from './financement';
import { calculerFiscalite, type ResultatFiscalite } from './fiscalite';
import type { Regles } from './regles/types';
import { calculerRendement, type ResultatRendement } from './rendement';
import { calculerRevente, type ResultatRevente } from './revente';
import { manquesDe, type Manque } from './schema/manques';
import { estComplet, type Projet, type ProjetComplet } from './schema/projet';
import { calculerVerdict, type ResultatVerdict } from './verdict';

/** Ce que tout rapport porte, complet ou partiel : rien ici ne dépend du loyer. */
interface ResultatsCommuns {
  readonly financement: ResultatFinancement;
  /** Estimation du prix du bien ; `null` sans ventes réelles connues. */
  readonly estimation: EstimationPrix | null;
  /** Toujours cinq feux ; ceux qui dépendent d'une donnée absente sont « inconnu » avec leur raison. */
  readonly verdict: ResultatVerdict;
  /** Données sans défaut que le projet ne donne pas ; l'interface sait quoi demander. */
  readonly manques: readonly Manque[];
}

/** Tout le rapport sauf les scénarios (qui recalculent une base par variante). */
export interface ResultatsBaseComplets extends ResultatsCommuns {
  readonly complet: true;
  readonly projet: ProjetComplet;
  /** Cash-flow du régime retenu. */
  readonly cashflow: ResultatCashflow;
  readonly fiscalite: ResultatFiscalite;
  readonly revente: ResultatRevente;
  readonly rendement: ResultatRendement;
}

/** Sans loyer : les sections qui en dépendent sont nulles, ensemble. */
export interface ResultatsBasePartiels extends ResultatsCommuns {
  readonly complet: false;
  readonly projet: Projet;
  readonly cashflow: null;
  readonly fiscalite: null;
  readonly revente: null;
  readonly rendement: null;
}

export type ResultatsBase = ResultatsBaseComplets | ResultatsBasePartiels;

/** Enchaîne les modules dans l'ordre de leurs dépendances. Le projet est supposé déjà validé. */
export function calculerComplet(projet: ProjetComplet, regles: Regles): ResultatsBaseComplets {
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
    complet: true,
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

/** Sans loyer : financement, estimation et verdict (prix, risques) ; le reste attend le loyer. */
export function calculerPartiel(projet: Projet, regles: Regles): ResultatsBasePartiels {
  const manques = manquesDe(projet);
  const financement = calculerFinancement(projet, regles);
  const estimation = estimerPrix(projet, regles);
  const verdict = calculerVerdict(projet, financement, null, null, regles, { estimation, manques });
  return {
    complet: false,
    projet,
    financement,
    cashflow: null,
    fiscalite: null,
    revente: null,
    rendement: null,
    estimation,
    verdict,
    manques,
  };
}

export function calculerBase(projet: Projet, regles: Regles): ResultatsBase {
  return estComplet(projet) ? calculerComplet(projet, regles) : calculerPartiel(projet, regles);
}
