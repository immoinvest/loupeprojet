import { prixRetenu } from '../achat';
import type { ResultatFinancement } from '../financement';
import type { ResultatFiscalite } from '../fiscalite/types';
import type { ResultatRevente } from '../revente';
import type { Projet } from '../schema/projet';
import { enrichissement, type Enrichissement } from './enrichissement';
import { rendements, type Rendements } from './rendements';
import { tri } from './tri';

export interface ResultatRendement {
  readonly rendements: Rendements;
  /** Cash-flows annuels après impôt du régime retenu. */
  readonly cashflowsApresImpot: readonly number[];
  /** Flux du TRI : mise de départ en 0, cash-flows, cash net de revente la dernière année. */
  readonly flux: readonly number[];
  readonly tri: number | null;
  readonly enrichissement: Enrichissement;
}

function sommeAnnee1<T extends { readonly annee: number }>(
  lignes: readonly T[],
  valeur: (l: T) => number,
): number {
  return lignes.filter((l) => l.annee === 1).reduce((acc, l) => acc + valeur(l), 0);
}

export function calculerRendement(
  projet: Projet,
  financement: ResultatFinancement,
  fiscalite: ResultatFiscalite,
  revente: ResultatRevente,
): ResultatRendement {
  const { achat } = projet.hypotheses;
  const retenu = fiscalite.regimes[fiscalite.retenu];
  const cashflowsApresImpot = retenu.annees.map((a) => a.cashflowApresImpot);
  const derniereAnnee = cashflowsApresImpot.length - 1;
  const flux = [
    -financement.miseDeDepart,
    ...cashflowsApresImpot.map((c, i) => (i === derniereAnnee ? c + revente.cashNetVendeur : c)),
  ];

  return {
    rendements: rendements({
      coutTotal: prixRetenu(achat) + achat.travaux + financement.fraisAcquisition.total,
      loyersBruts: retenu.cashflow.recettes.loyersBruts,
      loyersNets: retenu.cashflow.recettes.loyersNets,
      chargesAnnuelles: retenu.cashflow.chargesAnnuelles,
      interetsAnnee1: sommeAnnee1(financement.parAnnee, (a) => a.interets),
      assuranceAnnee1: sommeAnnee1(financement.parAnnee, (a) => a.assurance),
      impotAnnee1: sommeAnnee1(retenu.annees, (a) => a.impot),
    }),
    cashflowsApresImpot,
    flux,
    tri: tri(flux),
    enrichissement: enrichissement({
      miseDeDepart: financement.miseDeDepart,
      cashflowsApresImpot,
      montantEmprunte: financement.montantEmprunte,
      crdRevente: revente.crd,
      valeurRevente: revente.valeur,
      fraisVente: revente.fraisVente.total,
      ira: revente.ira,
      impotPlusValue: revente.plusValue.impotTotal,
      cashNetVendeur: revente.cashNetVendeur,
    }),
  };
}

export {
  enrichissement,
  type Enrichissement,
  type ParametresEnrichissement,
} from './enrichissement';
export { rendements, type ParametresRendements, type Rendements } from './rendements';
export { tri } from './tri';
