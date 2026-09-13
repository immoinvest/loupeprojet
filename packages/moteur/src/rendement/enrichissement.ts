export interface ParametresEnrichissement {
  readonly miseDeDepart: number;
  readonly cashflowsApresImpot: readonly number[];
  readonly montantEmprunte: number;
  readonly crdRevente: number;
  readonly valeurRevente: number;
  readonly fraisVente: number;
  readonly ira: number;
  readonly impotPlusValue: number;
  readonly cashNetVendeur: number;
}

export interface Enrichissement {
  readonly miseDeDepart: number;
  readonly cashflowsCumules: number;
  readonly capitalRembourse: number;
  /** Valeur nette de frais, d'IRA et d'impôt, moins tout ce que le projet a coûté (emprunt + mise). */
  readonly plusValueNette: number;
  /** = capital remboursé + plus-value nette + cash-flows cumulés = cash net vendeur + cash-flows − mise. */
  readonly total: number;
}

export function enrichissement(p: ParametresEnrichissement): Enrichissement {
  const cashflowsCumules = p.cashflowsApresImpot.reduce((acc, c) => acc + c, 0);
  const capitalRembourse = p.montantEmprunte - p.crdRevente;
  const plusValueNette =
    p.valeurRevente -
    p.fraisVente -
    p.ira -
    p.impotPlusValue -
    (p.montantEmprunte + p.miseDeDepart);
  return {
    miseDeDepart: p.miseDeDepart,
    cashflowsCumules,
    capitalRembourse,
    plusValueNette,
    total: p.cashNetVendeur + cashflowsCumules - p.miseDeDepart,
  };
}
