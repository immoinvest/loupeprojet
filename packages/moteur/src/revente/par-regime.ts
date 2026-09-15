import { prixRetenu } from '../achat';
import type { ResultatFinancement } from '../financement';
import { baseFraisAcquisition } from '../financement/frais-acquisition';
import type { ProjectionRegime } from '../fiscalite/types';
import type { Regles } from '../regles/types';
import type { Regime } from '../schema/hypotheses';
import type { Projet } from '../schema/projet';
import { plusValueImposable, type DetailPlusValue } from './plus-value';
import {
  fraisVente,
  valeurRevente,
  valorisationTravaux,
  type FraisVente,
  type ValorisationTravaux,
} from './valeur';

export interface ResultatRevente {
  readonly annees: number;
  /** Prix de vente retenu : le prix saisi s'il y en a un, sinon la valeur estimée. */
  readonly valeur: number;
  /** (Prix retenu + valorisation des travaux) capitalisé à l'évolution annuelle. */
  readonly valeurEstimee: number;
  /** Vrai quand `valeur` vient de `revente.prixVente`. */
  readonly valeurSaisie: boolean;
  readonly valorisationTravaux: ValorisationTravaux;
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
 * Prix d'acquisition = prix stipulé dans l'acte (prix retenu hors honoraires dus par l'acquéreur) ; ces
 * honoraires sont des frais d'acquisition, comparés au forfait de 7,5 % (BOI-RFPI-PVI-20-10-20-20 § 40
 * et 70). La valeur de revente part toujours du prix retenu : le marché vend honoraires compris.
 */
export function reventeDuRegime(
  projet: Projet,
  financement: ResultatFinancement,
  regime: Pick<ProjectionRegime, 'regime' | 'amortissementsImmeubleDeduits'>,
  regles: Regles,
): ResultatRevente {
  const { achat, revente } = projet.hypotheses;
  const prix = prixRetenu(achat);
  const valorisation = valorisationTravaux(projet, regles);
  const valeurEstimee = valeurRevente(
    prix + valorisation.montant,
    revente.evolutionAnnuelle,
    revente.annees,
  );
  const valeur = revente.prixVente ?? valeurEstimee;
  const frais = fraisVente(valeur, revente);
  const honorairesAcquereur = achat.honorairesChargeAcquereur ? achat.honorairesAgence : 0;
  const plusValue = plusValueImposable(
    {
      valeur,
      fraisVente: frais.total,
      prixAcquisition: baseFraisAcquisition(achat),
      fraisAcquisitionReels: financement.fraisAcquisition.total + honorairesAcquereur,
      travauxReels: achat.travaux,
      annees: revente.annees,
      amortissementsReintegres: amortissementsAReintegrer(regime),
    },
    regles,
  );
  return {
    annees: revente.annees,
    valeur,
    valeurEstimee,
    valeurSaisie: revente.prixVente !== undefined,
    valorisationTravaux: valorisation,
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
