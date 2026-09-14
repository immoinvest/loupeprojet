import { calculerProjet, type ProjetEntree } from '@loupe/moteur';

export interface VarianteRevente {
  readonly annees: number;
  readonly valeur: number;
  readonly cashNetVendeur: number;
  readonly impotPlusValue: number;
  readonly tri: number | null;
  readonly enrichissement: number;
}

/** Bornes de l'horizon de revente, alignées sur `ReventeSchema` du moteur (vérifié par test). */
export const HORIZON_MIN = 1;
export const HORIZON_MAX = 30;

export const HORIZONS: readonly number[] = [5, 10, 15, 20];

/** Le même projet revendu dans `annees` ans ; l'entrée n'est pas modifiée. */
export function projetAHorizon(projet: ProjetEntree, annees: number): ProjetEntree {
  return {
    ...projet,
    hypotheses: {
      ...projet.hypotheses,
      revente: { ...projet.hypotheses.revente, annees },
    },
  };
}

/** Le même projet revendu à différents horizons (sans scénarios : ~5 ms par horizon). */
export function variantesRevente(
  projet: ProjetEntree,
  horizons: readonly number[] = HORIZONS,
): VarianteRevente[] {
  return horizons.map((annees) => {
    const r = calculerProjet(projetAHorizon(projet, annees), { avecScenarios: false });
    return {
      annees,
      valeur: r.revente.valeur,
      cashNetVendeur: r.revente.cashNetVendeur,
      impotPlusValue: r.revente.plusValue.impotTotal,
      tri: r.rendement.tri,
      enrichissement: r.rendement.enrichissement.total,
    };
  });
}
