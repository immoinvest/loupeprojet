import { calculerFinancement } from '../financement';
import { cashflowDuRegime } from '../fiscalite';
import { resoudreOuNull } from '../commun/resolution';
import type { Regles } from '../regles/types';
import type { ProjetComplet } from '../schema/projet';

export type CriterePrix = 'cashflow_zero' | 'net_6' | 'brut_8';

export const CRITERES_PRIX: readonly CriterePrix[] = ['cashflow_zero', 'net_6', 'brut_8'];

export interface PrixCible {
  readonly critere: CriterePrix;
  /** Prix FAI auquel le critère est atteint ; `null` si aucun prix entre le plancher et 2 × le prix affiché ne convient. */
  readonly prix: number | null;
  /** Écart au prix affiché (décimal, négatif = à négocier). */
  readonly ecart: number | null;
}

const CIBLE_NET = 0.06;
const CIBLE_BRUT = 0.08;
const TOLERANCE_EURO = 0.5;

/** Variante achetée exactement à `prix` : la négociation est remise à zéro, ce prix est le prix retenu. */
export function avecPrix(projet: ProjetComplet, prix: number): ProjetComplet {
  return {
    ...projet,
    hypotheses: {
      ...projet.hypotheses,
      achat: { ...projet.hypotheses.achat, prix, negociationTaux: 0 },
    },
  };
}

/** Grandeur du critère pour un prix donné : positif quand la cible est dépassée. */
function ecartAuCritere(
  projet: ProjetComplet,
  prix: number,
  critere: CriterePrix,
  regles: Regles,
): number {
  const variante = avecPrix(projet, prix);
  const financement = calculerFinancement(variante, regles, { avecTaeg: false });
  const cashflow = cashflowDuRegime(
    variante,
    financement,
    variante.hypotheses.fiscalite.regime,
    regles,
  );
  switch (critere) {
    case 'cashflow_zero':
      return cashflow.mensuel;
    case 'net_6': {
      const coutTotal =
        prix + variante.hypotheses.achat.travaux + financement.fraisAcquisition.total;
      return (cashflow.recettes.loyersNets - cashflow.chargesAnnuelles) / coutTotal - CIBLE_NET;
    }
    case 'brut_8': {
      const coutTotal =
        prix + variante.hypotheses.achat.travaux + financement.fraisAcquisition.total;
      return cashflow.recettes.loyersBruts / coutTotal - CIBLE_BRUT;
    }
  }
}

/** Prix plancher : les honoraires à la charge de l'acquéreur ne peuvent pas dépasser le prix. */
function prixPlancher(projet: ProjetComplet): number {
  const { honorairesAgence, honorairesChargeAcquereur } = projet.hypotheses.achat;
  return honorairesChargeAcquereur ? honorairesAgence + 1 : 1;
}

/** Cherche entre le plancher et deux fois le prix affiché ; l'écart se lit depuis le prix affiché, celui que l'on négocie. */
export function prixCible(projet: ProjetComplet, critere: CriterePrix, regles: Regles): PrixCible {
  const prixAffiche = projet.hypotheses.achat.prix;
  const prix = resoudreOuNull(
    (p) => ecartAuCritere(projet, p, critere, regles),
    prixPlancher(projet),
    prixAffiche * 2,
    { tolerance: TOLERANCE_EURO },
  );
  return { critere, prix, ecart: prix === null ? null : prix / prixAffiche - 1 };
}
