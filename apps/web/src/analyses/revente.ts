import { calculerProjet, type ProjetEntree } from '@loupe/moteur';

export interface VarianteRevente {
  readonly annees: number;
  readonly valeur: number;
  readonly cashNetVendeur: number;
  readonly impotPlusValue: number;
  readonly tri: number | null;
  readonly enrichissement: number;
}

export const HORIZONS: readonly number[] = [5, 10, 15, 20];

/**
 * Le même projet revendu à différents horizons (sans scénarios : ~5 ms par horizon).
 * Vide quand le projet n'a pas de loyer : aucune revente ne peut être calculée.
 */
export function variantesRevente(
  projet: ProjetEntree,
  horizons: readonly number[] = HORIZONS,
): VarianteRevente[] {
  const variantes: VarianteRevente[] = [];
  for (const annees of horizons) {
    const r = calculerProjet(
      {
        ...projet,
        hypotheses: {
          ...projet.hypotheses,
          revente: { ...projet.hypotheses.revente, annees },
        },
      },
      { avecScenarios: false },
    );
    if (!r.complet) return [];
    variantes.push({
      annees,
      valeur: r.revente.valeur,
      cashNetVendeur: r.revente.cashNetVendeur,
      impotPlusValue: r.revente.plusValue.impotTotal,
      tri: r.rendement.tri,
      enrichissement: r.rendement.enrichissement.total,
    });
  }
  return variantes;
}
