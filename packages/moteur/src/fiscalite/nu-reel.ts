import { construireAnnee, finaliserRegime } from './commun-regime';
import {
  STOCK_VIDE,
  ajouterDeficit,
  imputerDeficits,
  totalDeficits,
  type StockDeficits,
} from './deficits';
import { assuranceAnnee, interetsPayesAnnee } from './interets';
import type { AnneeFiscale, ContexteFiscal, ProjectionRegime } from './types';

interface AnneeNuReel {
  readonly stock: StockDeficits;
  readonly resultat: AnneeFiscale;
}

/**
 * Nu au réel : charges, intérêts et frais d'emprunt déductibles, pas d'amortissement.
 * Frais de dossier et de garantie déduits l'année où ils sont payés, la première
 * (BOI-RFPI-BASE-20-80 § 190 et 240). Avec l'assurance emprunteur, ils suivent le régime des
 * intérêts, et le revenu brut compense d'abord ces frais financiers (BOI-RFPI-BASE-30-20 § 110) :
 * la part du déficit qui vient des autres charges s'impute sur le revenu global (plafonnée),
 * le reste se reporte 10 ans sur les revenus fonciers.
 */
function anneeNuReel(
  ctx: ContexteFiscal,
  stock: StockDeficits,
  annee: number,
  avantImpot: number,
  recettes: number,
  chargesExploitation: number,
): AnneeNuReel {
  const { projet, financement, regles } = ctx;
  const { tmi, psFoncier } = projet.hypotheses.fiscalite;
  const { deficitFoncier } = regles.fiscalite;
  const { achat, pret } = projet.hypotheses;
  const interets = interetsPayesAnnee(financement, annee);
  const fraisEmprunt =
    assuranceAnnee(financement, annee) + (annee === 1 ? pret.fraisDossier + pret.fraisGarantie : 0);
  const autresCharges = chargesExploitation + (annee === 1 ? achat.travaux : 0);
  const charges = autresCharges + fraisEmprunt;
  const resultat = recettes - charges - interets;

  let nouveauStock = stock;
  let baseImposable = 0;
  let deficitImpute = 0;
  let deficitImputeRevenuGlobal = 0;

  if (resultat < 0) {
    const plafond = achat.travauxRenovationEnergetique
      ? deficitFoncier.plafondRenovationEnergetique
      : deficitFoncier.plafondRevenuGlobal;
    const recettesApresFinancier = Math.max(0, recettes - interets - fraisEmprunt);
    const deficitHorsInterets = Math.max(0, autresCharges - recettesApresFinancier);
    deficitImputeRevenuGlobal = Math.min(deficitHorsInterets, plafond);
    nouveauStock = ajouterDeficit(
      stock,
      -resultat - deficitImputeRevenuGlobal,
      annee,
      deficitFoncier.reportAnnees,
    );
  } else {
    const imputation = imputerDeficits(stock, resultat, annee);
    nouveauStock = imputation.stock;
    deficitImpute = imputation.impute;
    baseImposable = resultat - deficitImpute;
  }

  return {
    stock: nouveauStock,
    resultat: construireAnnee({
      annee,
      recettes,
      chargesDeductibles: charges,
      interetsDeductibles: interets,
      amortissementsDeduits: 0,
      deficitImpute,
      deficitImputeRevenuGlobal,
      baseImposable,
      impotRevenu: baseImposable * tmi - deficitImputeRevenuGlobal * tmi,
      prelevementsSociaux: baseImposable * psFoncier,
      avantImpot,
      stocks: { deficitReportable: totalDeficits(nouveauStock), amortissementsReportes: 0 },
    }),
  };
}

export function projeterNuReel(ctx: ContexteFiscal): ProjectionRegime {
  let stock = STOCK_VIDE;
  const annees: AnneeFiscale[] = [];
  for (const a of ctx.cashflow.parAnnee) {
    const pas = anneeNuReel(ctx, stock, a.annee, a.avantImpot, a.recettes, a.charges);
    stock = pas.stock;
    annees.push(pas.resultat);
  }
  return finaliserRegime('nu_reel', ctx, annees, { eligible: true });
}
