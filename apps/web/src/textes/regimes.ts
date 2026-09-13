import type {
  CodeScenario,
  CriterePrix,
  ModeLocation,
  Regime,
  ResultatRegime,
} from '@loupe/moteur';

import { euros } from '@/formatage/nombres';

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

/** Ordre d'affichage : les régimes meublés, puis les nus, le réel avant le micro. */
export const ORDRE_REGIMES: readonly Regime[] = [
  'lmnp_reel',
  'micro_bic',
  'nu_reel',
  'micro_foncier',
];

/** Une phrase par régime, écrite à partir du résultat projeté. */
export function explicationRegime(r: ResultatRegime, annees: number): string {
  if (!r.eligible) {
    return 'Plafond de recettes dépassé avec ces loyers : ce régime est inaccessible.';
  }
  const premiere = r.premiereAnneeImposable;
  switch (r.regime) {
    case 'lmnp_reel': {
      // Réserve d'amortissements (art. 39 C) encore disponible à la fin de la période.
      let reserve = 0;
      for (const a of r.annees) reserve = a.stocks.amortissementsReportes;
      return premiere === null
        ? `Les amortissements effacent le résultat : aucun impôt sur ${String(annees)} ans, et ${euros(reserve)} restent en réserve. Comptable obligatoire, déjà compté.`
        : `Amortissements et déficits repoussent l'impôt jusqu'à l'année ${String(premiere)}. Comptable obligatoire, déjà compté.`;
    }
    case 'micro_bic':
      return 'Abattement de 50 % sur les recettes, sans comptable, mais imposé dès la première année.';
    case 'nu_reel':
      return premiere === null
        ? `Charges et intérêts déductibles, déficit foncier imputable : aucun impôt sur ${String(annees)} ans.`
        : `Déficit foncier les premières années, puis imposé à partir de l'année ${String(premiere)}.`;
    case 'micro_foncier':
      return 'Abattement de 30 % sur les loyers : le plus simple, souvent le plus cher avec un crédit.';
  }
}
