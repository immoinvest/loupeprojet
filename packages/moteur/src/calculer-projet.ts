import { calculerBase, type ResultatsBase } from './calculer-base';
import { obtenirRegles } from './regles';
import type { VersionRegles } from './regles/types';
import { calculerScenarios, type ResultatScenarios } from './scenarios';
import { ProjetSchema, type ProjetEntree } from './schema/projet';

export interface MetaResultats {
  readonly versionRegles: VersionRegles;
  readonly dateReference: string;
  /** Chemins des règles sans source officielle consolidée, à afficher avec un drapeau. */
  readonly aConfirmer: readonly string[];
  readonly simplifications: readonly string[];
}

export interface Resultats extends ResultatsBase {
  /** `null` quand les scénarios sont désactivés (calculs imbriqués). */
  readonly scenarios: ResultatScenarios | null;
  readonly meta: MetaResultats;
}

export interface OptionsCalcul {
  /** Défaut `true`. Les scénarios recalculent six variantes et trois prix cibles. */
  readonly avecScenarios?: boolean;
}

/**
 * Point d'entrée du moteur : valide le projet (défauts appliqués), charge les règles
 * de sa version et rend le rapport complet. Pur : même entrée, même sortie, entrée intacte.
 */
export function calculerProjet(entree: ProjetEntree, options: OptionsCalcul = {}): Resultats {
  const projet = ProjetSchema.parse(entree);
  const regles = obtenirRegles(projet.versionRegles);
  const base = calculerBase(projet, regles);
  const avecScenarios = options.avecScenarios ?? true;
  return {
    ...base,
    scenarios: avecScenarios ? calculerScenarios(projet, base, regles) : null,
    meta: {
      versionRegles: regles.version,
      dateReference: regles.dateReference,
      aConfirmer: regles.aConfirmer,
      simplifications: regles.simplifications,
    },
  };
}
