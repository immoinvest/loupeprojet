import { prixRetenu } from '../achat';
import type { ResultatFinancement } from '../financement';
import type { ResultatFiscalite } from '../fiscalite/types';
import type { Regles } from '../regles/types';
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

/** Les amortissements ne sont réintégrés que si le régime retenu est le LMNP réel (LF 2025). */
export function amortissementsAReintegrer(fiscalite: ResultatFiscalite): number {
  return fiscalite.retenu === 'lmnp_reel'
    ? fiscalite.regimes.lmnp_reel.amortissementsImmeubleDeduits
    : 0;
}

export function calculerRevente(
  projet: Projet,
  financement: ResultatFinancement,
  fiscalite: ResultatFiscalite,
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
      amortissementsReintegres: amortissementsAReintegrer(fiscalite),
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

export {
  abattementsDetention,
  plusValueImposable,
  tauxSurtaxe,
  type Abattements,
  type DetailPlusValue,
  type ParametresPlusValue,
} from './plus-value';
export { fraisVente, valeurRevente, type FraisVente } from './valeur';
