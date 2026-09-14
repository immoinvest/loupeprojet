import {
  calculerComplet,
  calculerPartiel,
  type ResultatsBaseComplets,
  type ResultatsBasePartiels,
} from './calculer-base';
import { obtenirRegles } from './regles';
import type { VersionRegles } from './regles/types';
import { calculerScenarios, type ResultatScenarios } from './scenarios';
import { ProjetSchema, estComplet, type ProjetEntree } from './schema/projet';

export interface MetaResultats {
  readonly versionRegles: VersionRegles;
  readonly dateReference: string;
  /** Chemins des règles sans source officielle consolidée, à afficher avec un drapeau. */
  readonly aConfirmer: readonly string[];
  readonly simplifications: readonly string[];
}

export interface ResultatsComplets extends ResultatsBaseComplets {
  /** `null` quand les scénarios sont désactivés (calculs imbriqués). */
  readonly scenarios: ResultatScenarios | null;
  readonly meta: MetaResultats;
}

export interface ResultatsPartiels extends ResultatsBasePartiels {
  readonly scenarios: null;
  readonly meta: MetaResultats;
}

/** Le rapport : complet, ou partiel quand le loyer manque (`complet` discrimine, `manques` explique). */
export type Resultats = ResultatsComplets | ResultatsPartiels;

export interface OptionsCalcul {
  /** Défaut `true`. Les scénarios recalculent six variantes et trois prix cibles. */
  readonly avecScenarios?: boolean;
}

/**
 * Point d'entrée du moteur : valide le projet (défauts appliqués), charge les règles
 * de sa version et rend le rapport, complet ou partiel. Pur : même entrée, même sortie,
 * entrée intacte. Ne lève que sur une entrée invalide.
 */
export function calculerProjet(entree: ProjetEntree, options: OptionsCalcul = {}): Resultats {
  const projet = ProjetSchema.parse(entree);
  const regles = obtenirRegles(projet.versionRegles);
  const meta: MetaResultats = {
    versionRegles: regles.version,
    dateReference: regles.dateReference,
    aConfirmer: regles.aConfirmer,
    simplifications: regles.simplifications,
  };
  if (!estComplet(projet)) return { ...calculerPartiel(projet, regles), scenarios: null, meta };
  const base = calculerComplet(projet, regles);
  const avecScenarios = options.avecScenarios ?? true;
  return {
    ...base,
    scenarios: avecScenarios ? calculerScenarios(projet, base, regles) : null,
    meta,
  };
}
