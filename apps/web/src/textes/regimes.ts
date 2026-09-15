import type {
  CodeScenario,
  CriterePrix,
  ModeLocation,
  Regime,
  ResultatFiscalite,
  ResultatRegime,
  ResultatRevente,
} from '@loupe/moteur';

import { euros, eurosSignes, pourcentage } from '@/formatage/nombres';

export const REGIMES: Readonly<Record<Regime, string>> = {
  micro_bic: 'Meublé micro-BIC',
  lmnp_reel: 'Meublé au réel',
  micro_foncier: 'Nu micro-foncier',
  nu_reel: 'Nu au réel',
};

/** Le type d'exploitation, en minuscules, pour une phrase (« loyer …, colocation »). */
export const MODES: Readonly<Record<ModeLocation, string>> = {
  nu: 'location nue',
  meuble: 'meublé longue durée',
  colocation: 'colocation',
  courte_duree: 'courte durée',
  moyenne_duree: 'moyenne durée',
};

/** Le type d'exploitation, en titre (boutons du sélecteur, titre de la carte « La location »). */
export const TYPES_LOCATION: Readonly<Record<ModeLocation, string>> = {
  nu: 'Nue',
  meuble: 'Meublée',
  colocation: 'Colocation',
  courte_duree: 'Courte durée',
  moyenne_duree: 'Moyenne durée',
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

/**
 * Impôt à la revente causé par la réintégration des amortissements du meublé au réel : l'écart avec
 * le micro-BIC, dont la revente est identique (même valeur, mêmes frais, même durée) sans réintégration.
 */
export function impotDuAuxAmortissements(f: ResultatFiscalite): number {
  return Math.max(0, f.regimes.lmnp_reel.impotRevente - f.regimes.micro_bic.impotRevente);
}

/**
 * Nu au réel : un déficit imputé sur le revenu global l'année A est repris si la location cesse
 * avant la fin de la 3ᵉ année qui suit (CGI art. 156 I 3°). Rend l'année du premier déficit concerné.
 */
export function anneeRepriseDeficit(r: ResultatRegime, annees: number): number | null {
  if (r.regime !== 'nu_reel') return null;
  const concernee = r.annees.find((a) => a.deficitImputeRevenuGlobal > 0 && annees < a.annee + 3);
  return concernee === undefined ? null : concernee.annee;
}

export function avertissementRepriseDeficit(annee: number): string {
  return `Revendre avant la fin de l'année ${String(annee + 3)} fait reprendre le déficit foncier imputé sur votre revenu l'année ${String(annee)} : l'économie d'impôt affichée serait en partie perdue.`;
}

/** Un abattement sans décimale quand il tombe juste (30 %), au centième sinon (8,25 %) : jamais arrondi. */
function abattement(taux: number): string {
  return pourcentage(taux, Number.isInteger(Math.round(taux * 10_000) / 100) ? 0 : 2);
}

/** Les lignes du tableau « La revente selon le régime ». */
export const LIGNES_REVENTE: readonly {
  readonly titre: string;
  readonly valeur: (r: ResultatRevente) => string;
  readonly fort?: boolean;
}[] = [
  { titre: 'Prix de cession, frais déduits', valeur: (r) => euros(r.plusValue.prixCession) },
  {
    titre: "Prix d'acquisition majoré",
    valeur: (r) => euros(r.plusValue.prixAcquisitionMajore),
  },
  {
    titre: 'dont amortissements réintégrés',
    valeur: (r) => eurosSignes(-r.plusValue.reintegration),
  },
  { titre: 'Plus-value brute', valeur: (r) => euros(r.plusValue.plusValueBrute) },
  {
    titre: 'Abattement impôt sur le revenu',
    valeur: (r) => abattement(r.plusValue.abattements.ir),
  },
  {
    titre: 'Abattement prélèvements sociaux',
    valeur: (r) => abattement(r.plusValue.abattements.ps),
  },
  { titre: 'Impôt sur le revenu', valeur: (r) => euros(r.plusValue.impotIr) },
  { titre: 'Prélèvements sociaux', valeur: (r) => euros(r.plusValue.impotPs) },
  { titre: 'Surtaxe', valeur: (r) => euros(r.plusValue.surtaxe) },
  { titre: 'Impôt à la revente', valeur: (r) => euros(r.plusValue.impotTotal), fort: true },
  { titre: 'Cash net de revente', valeur: (r) => eurosSignes(r.cashNetVendeur), fort: true },
];

/**
 * Une phrase par régime, écrite à partir du résultat projeté. `impotAmortissements` : l'impôt à la
 * revente dû aux amortissements réintégrés (meublé au réel), voir `impotDuAuxAmortissements`.
 */
export function explicationRegime(
  r: ResultatRegime,
  annees: number,
  impotAmortissements = 0,
): string {
  if (!r.eligible) {
    return 'Plafond de recettes dépassé avec ces loyers : ce régime est inaccessible.';
  }
  const premiere = r.premiereAnneeImposable;
  switch (r.regime) {
    case 'lmnp_reel': {
      // Réserve d'amortissements (art. 39 C) encore disponible à la fin de la période.
      let reserve = 0;
      for (const a of r.annees) reserve = a.stocks.amortissementsReportes;
      const pendant =
        premiere === null
          ? `Les amortissements effacent le résultat : aucun impôt sur ${String(annees)} ans, et ${euros(reserve)} restent en réserve.`
          : `Amortissements et déficits repoussent l'impôt jusqu'à l'année ${String(premiere)}.`;
      const revente =
        impotAmortissements > 0
          ? ` Mais ils sont réintégrés à la plus-value : ${euros(impotAmortissements)} d'impôt s'ajoutent à la revente (sauf résidence services).`
          : '';
      return `${pendant}${revente} Comptable obligatoire, déjà compté.`;
    }
    case 'micro_bic': {
      // L'abattement appliqué par le moteur (50 %, ou 30 % en meublé de tourisme non classé), lu sur
      // la première année plutôt que recopié.
      const a = r.annees[0];
      const abattement =
        a === undefined || a.recettes === 0
          ? 'Abattement forfaitaire'
          : `Abattement de ${pourcentage(1 - a.baseImposable / a.recettes, 0)}`;
      return `${abattement} sur les recettes, sans comptable, mais imposé dès la première année.`;
    }
    case 'nu_reel':
      return premiere === null
        ? `Charges et intérêts déductibles, déficit foncier imputable : aucun impôt sur ${String(annees)} ans.`
        : `Déficit foncier les premières années, puis imposé à partir de l'année ${String(premiere)}.`;
    case 'micro_foncier':
      return 'Abattement de 30 % sur les loyers : le plus simple, souvent le plus cher avec un crédit.';
  }
}
