import { construireAnnee, finaliserRegime } from './commun-regime';
import {
  STOCK_VIDE,
  ajouterDeficit,
  imputerDeficits,
  totalDeficits,
  type StockDeficits,
} from './deficits';
import { assuranceAnnee, interetsPayesAnnee } from './interets';
import type { AnneeFiscale, ContexteFiscal, ResultatRegime } from './types';

interface AnneeNuReel {
  readonly stock: StockDeficits;
  readonly resultat: AnneeFiscale;
}

/**
 * Nu au réel : charges et intérêts déductibles, pas d'amortissement.
 * Un déficit hors intérêts s'impute sur le revenu global (plafonné) ; la part liée
 * aux intérêts et l'excédent se reportent 10 ans sur les revenus fonciers.
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
  const { achat } = projet.hypotheses;
  const interets = interetsPayesAnnee(financement, annee);
  const charges =
    chargesExploitation + assuranceAnnee(financement, annee) + (annee === 1 ? achat.travaux : 0);
  const resultat = recettes - charges - interets;

  let nouveauStock = stock;
  let baseImposable = 0;
  let deficitImpute = 0;
  let deficitImputeRevenuGlobal = 0;

  if (resultat < 0) {
    const plafond = achat.travauxRenovationEnergetique
      ? deficitFoncier.plafondRenovationEnergetique
      : deficitFoncier.plafondRevenuGlobal;
    const deficitHorsInterets = Math.max(0, charges - recettes);
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

export function projeterNuReel(ctx: ContexteFiscal): ResultatRegime {
  let stock = STOCK_VIDE;
  const annees: AnneeFiscale[] = [];
  for (const a of ctx.cashflow.parAnnee) {
    const pas = anneeNuReel(ctx, stock, a.annee, a.avantImpot, a.recettes, a.charges);
    stock = pas.stock;
    annees.push(pas.resultat);
  }
  return finaliserRegime('nu_reel', ctx, annees, { eligible: true });
}
