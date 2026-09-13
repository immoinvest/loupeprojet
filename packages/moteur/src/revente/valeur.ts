import type { Hypotheses } from '../schema/hypotheses';

export interface FraisVente {
  readonly agence: number;
  readonly diagnostics: number;
  readonly total: number;
}

/** Valeur estimée à la revente : prix d'aujourd'hui capitalisé à l'évolution annuelle. */
export function valeurRevente(prix: number, evolutionAnnuelle: number, annees: number): number {
  return prix * (1 + evolutionAnnuelle) ** annees;
}

export function fraisVente(valeur: number, revente: Hypotheses['revente']): FraisVente {
  const agence = valeur * revente.fraisAgenceTaux;
  return { agence, diagnostics: revente.diagnostics, total: agence + revente.diagnostics };
}
