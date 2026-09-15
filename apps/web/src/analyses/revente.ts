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

/** Le même projet sans prix de vente saisi : la revente suit l'estimation. */
export function sansPrixVente(projet: ProjetEntree): ProjetEntree {
  const revente = projet.hypotheses.revente ?? {};
  return {
    ...projet,
    hypotheses: {
      ...projet.hypotheses,
      revente: Object.fromEntries(Object.entries(revente).filter(([cle]) => cle !== 'prixVente')),
    },
  };
}

/**
 * Le même projet revendu à différents horizons (sans scénarios : ~5 ms par horizon), toujours au prix
 * estimé : un prix de vente saisi ne vaut que pour l'horizon choisi.
 * Vide quand le projet n'a pas de loyer : aucune revente ne peut être calculée.
 */
export function variantesRevente(
  projet: ProjetEntree,
  horizons: readonly number[] = HORIZONS,
): VarianteRevente[] {
  const variantes: VarianteRevente[] = [];
  const estime = sansPrixVente(projet);
  for (const annees of horizons) {
    const r = calculerProjet(projetAHorizon(estime, annees), { avecScenarios: false });
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
