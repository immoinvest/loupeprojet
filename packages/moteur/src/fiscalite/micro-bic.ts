import { SANS_STOCKS, construireAnnee, eligibiliteMicro, finaliserRegime } from './commun-regime';
import type { ContexteFiscal, ResultatRegime } from './types';

/** Micro-BIC : abattement forfaitaire, pas de charge déductible, pas de déficit possible. */
export function projeterMicroBic(ctx: ContexteFiscal): ResultatRegime {
  const { projet, cashflow, regles } = ctx;
  const { microBic } = regles.fiscalite;
  const { tmi, psBic } = projet.hypotheses.fiscalite;
  const tourismeNonClasse =
    cashflow.recettes.mode === 'courte_duree' &&
    projet.hypotheses.location.courteDuree?.tourismeClasse !== true;
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
