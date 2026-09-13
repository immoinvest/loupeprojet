import type { Hypotheses, Regime } from '../schema/hypotheses';

export type CodeCharge =
  'taxeFonciere' | 'copro' | 'pno' | 'comptable' | 'cfe' | 'gestion' | 'entretien';

export interface LigneCharge {
  readonly code: CodeCharge;
  readonly annuel: number;
}

export function estMeuble(regime: Regime): boolean {
  return regime === 'micro_bic' || regime === 'lmnp_reel';
}

/**
 * Charges d'exploitation annuelles à la charge du propriétaire, charges pleines.
 * Le comptable ne compte qu'au réel meublé, la CFE qu'en meublé.
 */
export function chargesExploitation(
  hypotheses: Hypotheses,
  regime: Regime,
  loyersNets: number,
): LigneCharge[] {
  const { charges, location, achat } = hypotheses;
  return [
    { code: 'taxeFonciere', annuel: charges.taxeFonciere },
    { code: 'copro', annuel: charges.coproAnnuel },
    { code: 'pno', annuel: charges.pno },
    { code: 'comptable', annuel: regime === 'lmnp_reel' ? charges.comptable : 0 },
    { code: 'cfe', annuel: estMeuble(regime) ? charges.cfe : 0 },
    { code: 'gestion', annuel: location.gestionTaux * loyersNets },
    { code: 'entretien', annuel: charges.entretienTaux * achat.prix },
  ];
}

export function totalCharges(lignes: readonly LigneCharge[]): number {
  return lignes.reduce((acc, l) => acc + l.annuel, 0);
}
