import { calculerComplet, type ResultatsBaseComplets } from '../calculer-base';
import type { Regles } from '../regles/types';
import type { ProjetComplet } from '../schema/projet';
import { TRANSFORMATIONS, type CodeScenario, type Variante } from './predefinis';
import { CRITERES_PRIX, prixCible, type PrixCible } from './prix-cible';

export interface IndicateursScenario {
  readonly cashflowMensuel: number;
  readonly rendementNet: number;
  readonly impotTotal: number;
  readonly tri: number | null;
  readonly enrichissement: number;
}

export interface ResultatScenario {
  readonly code: CodeScenario;
  readonly parametres: Readonly<Record<string, number | string>>;
  readonly indicateurs: IndicateursScenario;
  /** Variante − référence ; le TRI est `null` si l'un des deux l'est. */
  readonly deltas: IndicateursScenario;
}

export interface ResultatScenarios {
  readonly scenarios: readonly ResultatScenario[];
  readonly prixCibles: readonly PrixCible[];
}

export function indicateurs(base: ResultatsBaseComplets): IndicateursScenario {
  const retenu = base.fiscalite.regimes[base.fiscalite.retenu];
  return {
    cashflowMensuel: base.cashflow.mensuel,
    rendementNet: base.rendement.rendements.net,
    impotTotal: retenu.impotTotal,
    tri: base.rendement.tri,
    enrichissement: base.rendement.enrichissement.total,
  };
}

function deltas(
  variante: IndicateursScenario,
  reference: IndicateursScenario,
): IndicateursScenario {
  return {
    cashflowMensuel: variante.cashflowMensuel - reference.cashflowMensuel,
    rendementNet: variante.rendementNet - reference.rendementNet,
    impotTotal: variante.impotTotal - reference.impotTotal,
    tri: variante.tri === null || reference.tri === null ? null : variante.tri - reference.tri,
    enrichissement: variante.enrichissement - reference.enrichissement,
  };
}

/** Recalcule tout le rapport pour une variante (complète par construction) et le compare à la référence. */
export function evaluerVariante(
  variante: Variante,
  reference: IndicateursScenario,
  regles: Regles,
): ResultatScenario {
  const ind = indicateurs(calculerComplet(variante.projet, regles));
  return {
    code: variante.code,
    parametres: variante.parametres,
    indicateurs: ind,
    deltas: deltas(ind, reference),
  };
}

export function calculerScenarios(
  projet: ProjetComplet,
  reference: ResultatsBaseComplets,
  regles: Regles,
): ResultatScenarios {
  const ref = indicateurs(reference);
  return {
    scenarios: TRANSFORMATIONS.map((t) => evaluerVariante(t(projet, regles), ref, regles)),
    prixCibles: CRITERES_PRIX.map((critere) => prixCible(projet, critere, regles)),
  };
}

export { TRANSFORMATIONS, type CodeScenario, type Variante } from './predefinis';
export { CRITERES_PRIX, avecPrix, prixCible, type CriterePrix, type PrixCible } from './prix-cible';
