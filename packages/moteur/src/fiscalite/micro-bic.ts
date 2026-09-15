import { SANS_STOCKS, construireAnnee, eligibiliteMicro, finaliserRegime } from './commun-regime';
import type { ContexteFiscal, ProjectionRegime } from './types';

/**
 * Micro-BIC : abattement forfaitaire sur les recettes encaissées (forfaits de charges compris), pas de
 * charge déductible, pas de déficit possible. Meublé de tourisme non classé (loi du 19/11/2024) :
 * abattement et plafond réduits.
 */
export function projeterMicroBic(ctx: ContexteFiscal): ProjectionRegime {
  const { projet, cashflow, regles } = ctx;
  const { microBic } = regles.fiscalite;
  const { tmi, psBic } = projet.hypotheses.fiscalite;
  const { location } = projet.hypotheses;
  const tourismeNonClasse = location.mode === 'courte_duree' && !location.tourismeClasse;
  const abattement = tourismeNonClasse ? microBic.abattementTourismeNonClasse : microBic.abattement;
  const plafond = tourismeNonClasse ? microBic.plafondTourismeNonClasse : microBic.plafond;

  const annees = cashflow.parAnnee.map((a) => {
    const baseImposable = a.recettes * (1 - abattement);
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
      prelevementsSociaux: baseImposable * psBic,
      avantImpot: a.avantImpot,
      stocks: SANS_STOCKS,
    });
  });

  return finaliserRegime(
    'micro_bic',
    ctx,
    annees,
    eligibiliteMicro(cashflow.recettes.loyersNets, plafond),
  );
}
