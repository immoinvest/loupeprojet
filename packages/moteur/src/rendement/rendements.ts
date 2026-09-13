export interface ParametresRendements {
  /** Prix + travaux + frais d'acquisition. */
  readonly coutTotal: number;
  /** Loyers annuels hors charges, avant vacance. */
  readonly loyersBruts: number;
  /** Loyers encaissés, vacance déduite. */
  readonly loyersNets: number;
  readonly chargesAnnuelles: number;
  readonly interetsAnnee1: number;
  readonly assuranceAnnee1: number;
  readonly impotAnnee1: number;
}

export interface Rendements {
  readonly coutTotal: number;
  readonly brut: number;
  /** Charges pleines et vacance déduites. */
  readonly net: number;
  /** Après intérêts, assurance et impôt de la première année pleine. */
  readonly netNet: number;
}

export function rendements(p: ParametresRendements): Rendements {
  const netAnnuel = p.loyersNets - p.chargesAnnuelles;
  return {
    coutTotal: p.coutTotal,
    brut: p.loyersBruts / p.coutTotal,
    net: netAnnuel / p.coutTotal,
    netNet: (netAnnuel - p.interetsAnnee1 - p.assuranceAnnee1 - p.impotAnnee1) / p.coutTotal,
  };
}
