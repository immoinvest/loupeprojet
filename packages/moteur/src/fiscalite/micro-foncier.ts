import { SANS_STOCKS, construireAnnee, eligibiliteMicro, finaliserRegime } from './commun-regime';
import type { ContexteFiscal, ProjectionRegime } from './types';

/** Micro-foncier : abattement de 30 %, plafond de loyers, aucun déficit possible. */
export function projeterMicroFoncier(ctx: ContexteFiscal): ProjectionRegime {
  const { projet, cashflow, regles } = ctx;
  const { microFoncier } = regles.fiscalite;
  const { tmi, psFoncier } = projet.hypotheses.fiscalite;

  const annees = cashflow.parAnnee.map((a) => {
    const baseImposable = a.recettes * (1 - microFoncier.abattement);
    return construireAnnee({
      annee: a.annee,
      recettes: a.recettes,
      chargesDeductibles: 0,
      interetsDeductibles: 0,
      amortissementsDeduits: 0,
      deficitImpute: 0,
      deficitImputeRevenuGlobal: 0,
      baseImposable,
      impotRevenu: baseImposable * tmi,
      prelevementsSociaux: baseImposable * psFoncier,
      avantImpot: a.avantImpot,
      stocks: SANS_STOCKS,
    });
  });

  return finaliserRegime(
    'micro_foncier',
    ctx,
    annees,
    eligibiliteMicro(cashflow.recettes.loyersNets, microFoncier.plafond),
  );
}
