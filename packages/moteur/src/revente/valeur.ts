import { arrondirEuro } from '../commun/arrondi';
import { estimerPrix, estimerTravaux } from '../estimation';
import type { Regles } from '../regles/types';
import type { Hypotheses } from '../schema/hypotheses';
import type { Projet } from '../schema/projet';

export interface FraisVente {
  readonly agence: number;
  readonly diagnostics: number;
  readonly total: number;
}

/** `etat` : écart de l'estimation vers « rénové » ; `repli` : part fixe des travaux ; `aucune` : pas de travaux. */
export type MethodeValorisation = 'aucune' | 'etat' | 'repli';

export interface ValorisationTravaux {
  /** Ce que les travaux ajoutent à la valeur d'aujourd'hui, arrondi à l'euro. */
  readonly montant: number;
  readonly methode: MethodeValorisation;
}

/** Valeur estimée à la revente : valeur d'aujourd'hui capitalisée à l'évolution annuelle. */
export function valeurRevente(prix: number, evolutionAnnuelle: number, annees: number): number {
  return prix * (1 + evolutionAnnuelle) ** annees;
}

/**
 * Ce que les travaux ajoutent à la valeur du bien. Avec l'état et des ventes comparables : l'écart entre
 * l'estimation « rénové » et l'estimation à l'état actuel, au prorata des travaux faits par rapport aux
 * travaux estimés pour cet état, sans jamais dépasser le montant des travaux. Sinon : la part de repli
 * des règles. Pure.
 */
export function valorisationTravaux(projet: Projet, regles: Regles): ValorisationTravaux {
  const { travaux } = projet.hypotheses.achat;
  if (travaux <= 0) return { montant: 0, methode: 'aucune' };
  // Travaux estimés `null` exactement quand l'état est inconnu.
  const estimes = estimerTravaux(projet.bien, regles);
  const estimation = estimes === null ? null : estimerPrix(projet, regles);
  if (estimes === null || estimation === null) {
    return {
      montant: arrondirEuro(travaux * regles.revente.valorisationTravauxRepli),
      methode: 'repli',
    };
  }
  const ecart = Math.max(0, estimation.selonEtat.renove - estimation.selonEtat[estimes.etat]);
  const part = estimes.estime > 0 ? Math.min(1, travaux / estimes.estime) : 1;
  return { montant: arrondirEuro(Math.min(travaux, ecart * part)), methode: 'etat' };
}

export function fraisVente(valeur: number, revente: Hypotheses['revente']): FraisVente {
  const agence = valeur * revente.fraisAgenceTaux;
  return { agence, diagnostics: revente.diagnostics, total: agence + revente.diagnostics };
}
