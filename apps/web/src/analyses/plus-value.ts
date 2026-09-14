import { abattementsDetention, type Regles } from '@loupe/moteur';

/** Ce que la plus-value paierait l'année choisie, d'après les règles du projet. */
export interface ImpositionPlusValue {
  readonly annees: number;
  /** Part de la plus-value exonérée d'impôt sur le revenu (0 à 1). */
  readonly abattementIr: number;
  /** Part exonérée de prélèvements sociaux (0 à 1). */
  readonly abattementPs: number;
  /**
   * Taux global appliqué à la plus-value brute : impôt sur le revenu et prélèvements sociaux
   * après abattements, hors surtaxe (36,2 % avant la 6ᵉ année, 0 % à 30 ans).
   */
  readonly tauxGlobal: number;
}

/** Lit les taux et les abattements dans les règles : rien n'est recopié. */
export function impositionPlusValue(annees: number, regles: Regles): ImpositionPlusValue {
  const { ir, ps } = abattementsDetention(annees, regles);
  const { tauxIr } = regles.fiscalite.plusValue;
  const tauxPs = regles.fiscalite.prelevementsSociaux.plusValue;
  return {
    annees,
    abattementIr: ir,
    abattementPs: ps,
    tauxGlobal: tauxIr * (1 - ir) + tauxPs * (1 - ps),
  };
}

export interface SeuilsExoneration {
  /** Première année de détention sans impôt sur le revenu sur la plus-value ; `null` si jamais. */
  readonly ir: number | null;
  /** Première année sans prélèvements sociaux ; `null` si jamais. */
  readonly ps: number | null;
}

/** Les années où les abattements atteignent 100 %, cherchées dans les règles jusqu'à `maxAnnees`. */
export function seuilsExoneration(regles: Regles, maxAnnees: number): SeuilsExoneration {
  let ir: number | null = null;
  let ps: number | null = null;
  for (let annees = 1; annees <= maxAnnees; annees += 1) {
    const abattements = abattementsDetention(annees, regles);
    if (ir === null && abattements.ir >= 1) ir = annees;
    if (ps === null && abattements.ps >= 1) ps = annees;
  }
  return { ir, ps };
}
