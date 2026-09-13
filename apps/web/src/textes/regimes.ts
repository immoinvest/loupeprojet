import type { CodeScenario, CriterePrix, ModeLocation, Regime } from '@loupe/moteur';

export const REGIMES: Readonly<Record<Regime, string>> = {
  micro_bic: 'Meublé micro-BIC',
  lmnp_reel: 'Meublé au réel',
  micro_foncier: 'Nu micro-foncier',
  nu_reel: 'Nu au réel',
};

export const MODES: Readonly<Record<ModeLocation, string>> = {
  meuble_lld: 'meublé longue durée',
  nu: 'location nue',
  courte_duree: 'courte durée',
};

export const SCENARIOS: Readonly<Record<CodeScenario, string>> = {
  negocier: 'Négocier',
  colocation: 'Colocation',
  duree: 'Changer la durée du prêt',
  tauxPlus050: 'Taux +0,5 point',
  nu: 'Passer en location nue',
  meuble: 'Passer en meublé',
  vacance2Mois: 'Deux mois vides par an',
};

export const CRITERES_PRIX: Readonly<Record<CriterePrix, string>> = {
  cashflow_zero: "Cash-flow à l'équilibre",
  net_6: 'Rendement net 6 %',
  brut_8: 'Rendement brut 8 %',
};
