export interface LotDeficit {
  readonly montant: number;
  /** Dernière année où ce lot peut encore être imputé. */
  readonly derniereAnnee: number;
}

/** Stock de déficits reportables, du plus ancien au plus récent (imputation FIFO). */
export type StockDeficits = readonly LotDeficit[];

export const STOCK_VIDE: StockDeficits = [];

function purger(stock: StockDeficits, annee: number): StockDeficits {
  return stock.filter((lot) => lot.derniereAnnee >= annee && lot.montant > 0);
}

export function ajouterDeficit(
  stock: StockDeficits,
  montant: number,
  annee: number,
  reportAnnees: number,
): StockDeficits {
  const vivant = purger(stock, annee);
  if (montant <= 0) return vivant;
  return [...vivant, { montant, derniereAnnee: annee + reportAnnees }];
}

export interface Imputation {
  readonly stock: StockDeficits;
  readonly impute: number;
}

/** Impute les déficits vivants sur un résultat positif, les plus anciens d'abord. */
export function imputerDeficits(stock: StockDeficits, resultat: number, annee: number): Imputation {
  let reste = Math.max(0, resultat);
  let impute = 0;
  const nouveau: LotDeficit[] = [];
  for (const lot of purger(stock, annee)) {
    const pris = Math.min(lot.montant, reste);
    reste -= pris;
    impute += pris;
    if (lot.montant - pris > 0) nouveau.push({ ...lot, montant: lot.montant - pris });
  }
  return { stock: nouveau, impute };
}

export function totalDeficits(stock: StockDeficits): number {
  return stock.reduce((acc, lot) => acc + lot.montant, 0);
}
