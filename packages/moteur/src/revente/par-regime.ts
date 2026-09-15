import { prixRetenu } from '../achat';
import type { ResultatFinancement } from '../financement';
import type { ProjectionRegime } from '../fiscalite/types';
import type { Regles } from '../regles/types';
import type { Regime } from '../schema/hypotheses';
import type { Projet } from '../schema/projet';
import { plusValueImposable, type DetailPlusValue } from './plus-value';
import { fraisVente, valeurRevente, type FraisVente } from './valeur';

export interface ResultatRevente {
  readonly annees: number;
  readonly valeur: number;
  readonly fraisVente: FraisVente;
  readonly crd: number;
  readonly ira: number;
  readonly plusValue: DetailPlusValue;
  /** Valeur − frais de vente − capital restant dû − IRA − impôt sur la plus-value. */
  readonly cashNetVendeur: number;
}

/**
 * Amortissements de l'immeuble réintégrés à la plus-value (LF 2025, depuis le 15/02/2025) : LMNP réel
 * seulement. Le micro-BIC ne déduit aucun amortissement, la location nue non plus.
 */
export function amortissementsAReintegrer(
  regime: Pick<ProjectionRegime, 'regime' | 'amortissementsImmeubleDeduits'>,
): number {
  return regime.regime === 'lmnp_reel' ? regime.amortissementsImmeubleDeduits : 0;
}

/**
 * La revente d'un régime : même valeur, mêmes frais, même capital restant dû pour tous ; seule la
 * réintégration des amortissements, donc l'impôt sur la plus-value, dépend du régime.
 */
export function reventeDuRegime(
  projet: Projet,
  financement: ResultatFinancement,
  regime: Pick<ProjectionRegime, 'regime' | 'amortissementsImmeubleDeduits'>,
  regles: Regles,
): ResultatRevente {
  const { achat, revente } = projet.hypotheses;
  const prix = prixRetenu(achat);
  const valeur = valeurRevente(prix, revente.evolutionAnnuelle, revente.annees);
  const frais = fraisVente(valeur, revente);
  const plusValue = plusValueImposable(
    {
      valeur,
      fraisVente: frais.total,
      prixAcquisition: prix,
      fraisAcquisitionReels: financement.fraisAcquisition.total,
      travauxReels: achat.travaux,
      annees: revente.annees,
      amortissementsReintegres: amortissementsAReintegrer(regime),
    },
    regles,
  );
  return {
    annees: revente.annees,
    valeur,
    fraisVente: frais,
    crd: financement.crdRevente,
    ira: financement.iraRevente,
    plusValue,
    cashNetVendeur:
      valeur - frais.total - financement.crdRevente - financement.iraRevente - plusValue.impotTotal,
  };
}

/** Une revente par régime projeté. */
export function reventeParRegime(
  projet: Projet,
  financement: ResultatFinancement,
  projections: readonly ProjectionRegime[],
  regles: Regles,
): Readonly<Record<Regime, ResultatRevente>> {
  return Object.fromEntries(
    projections.map((p) => [p.regime, reventeDuRegime(projet, financement, p, regles)]),
  ) as Record<Regime, ResultatRevente>;
}
