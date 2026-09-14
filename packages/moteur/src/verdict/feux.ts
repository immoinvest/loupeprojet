import type { TauxEffort } from '../financement/effort';
import type { Regles } from '../regles/types';
import type { Bien } from '../schema/bien';
import type { CodeManque } from '../schema/manques';
import type { Marche } from '../schema/marche';

export type Feu = 'bon' | 'surveiller' | 'probleme' | 'inconnu';
export type AxeVerdict = 'prix' | 'rendement' | 'cashflow' | 'effort' | 'risques';

export interface FeuVerdict {
  readonly axe: AxeVerdict;
  readonly feu: Feu;
  /** Grandeur jugée : écart de prix (décimal), rendement net, cash-flow mensuel, effort, nombre de signaux. */
  readonly valeur: number | null;
  /** Donnée absente qui rend le feu « inconnu » ; `null` sinon (feu connu, ou inconnu faute de marché). */
  readonly raison: CodeManque | null;
}

/** Plus la valeur est basse, mieux c'est (écart de prix, effort). */
function feuCroissant(valeur: number, bonJusqua: number, surveillerJusqua: number): Feu {
  if (valeur <= bonJusqua) return 'bon';
  if (valeur <= surveillerJusqua) return 'surveiller';
  return 'probleme';
}

/** Plus la valeur est haute, mieux c'est (rendement, cash-flow). */
function feuDecroissant(valeur: number, bonDes: number, surveillerDes: number): Feu {
  if (valeur >= bonDes) return 'bon';
  if (valeur >= surveillerDes) return 'surveiller';
  return 'probleme';
}

function inconnu(axe: AxeVerdict, raison: CodeManque | null): FeuVerdict {
  return { axe, feu: 'inconnu', valeur: null, raison };
}

/**
 * Prix au m² comparé au prix au m² estimé du bien quand l'estimation existe, sinon à la médiane des ventes
 * réelles (DVF).
 */
export function feuPrix(
  prixM2: number,
  marche: Marche,
  regles: Regles,
  prixM2Estime: number | null = null,
): FeuVerdict {
  if (marche.dvf === undefined) return inconnu('prix', null);
  const ecart = prixM2 / (prixM2Estime ?? marche.dvf.medianM2) - 1;
  const { bonJusqua, surveillerJusqua } = regles.verdict.prix;
  return {
    axe: 'prix',
    feu: feuCroissant(ecart, bonJusqua, surveillerJusqua),
    valeur: ecart,
    raison: null,
  };
}

/** `null` : le rendement n'a pas pu être calculé (loyer absent), la raison le dit. */
export function feuRendement(
  rendementNet: number | null,
  regles: Regles,
  raison: CodeManque | null = null,
): FeuVerdict {
  if (rendementNet === null) return inconnu('rendement', raison);
  const { bonDes, surveillerDes } = regles.verdict.rendementNet;
  return {
    axe: 'rendement',
    feu: feuDecroissant(rendementNet, bonDes, surveillerDes),
    valeur: rendementNet,
    raison: null,
  };
}

/** `null` : le cash-flow n'a pas pu être calculé (loyer absent), la raison le dit. */
export function feuCashflow(
  cashflowMensuel: number | null,
  regles: Regles,
  raison: CodeManque | null = null,
): FeuVerdict {
  if (cashflowMensuel === null) return inconnu('cashflow', raison);
  const { bonDes, surveillerDes } = regles.verdict.cashflowMensuel;
  return {
    axe: 'cashflow',
    feu: feuDecroissant(cashflowMensuel, bonDes, surveillerDes),
    valeur: cashflowMensuel,
    raison: null,
  };
}

/** Effort HCSF inconnu (revenus ou loyer absents) : feu « inconnu » avec la donnée qui manque. */
export function feuEffort(
  effort: TauxEffort,
  regles: Regles,
  raison: CodeManque | null = null,
): FeuVerdict {
  if (effort.hcsf === null) return inconnu('effort', raison);
  const { bonJusqua, surveillerJusqua } = regles.verdict.effort;
  return {
    axe: 'effort',
    feu: feuCroissant(effort.hcsf, bonJusqua, surveillerJusqua),
    valeur: effort.hcsf,
    raison: null,
  };
}

/** DPE F/G = problème ; DPE E, copro en procédure ou risque fort = à surveiller. */
export function feuRisques(bien: Bien, marche: Marche): FeuVerdict {
  const bloquants = bien.dpe === 'F' || bien.dpe === 'G' ? 1 : 0;
  const signaux =
    (bien.dpe === 'E' ? 1 : 0) +
    (bien.copro?.procedure === true ? 1 : 0) +
    marche.risques.filter((r) => r.niveau === 'fort').length;
  const total = bloquants + signaux;
  const feu: Feu = bloquants > 0 ? 'probleme' : signaux > 0 ? 'surveiller' : 'bon';
  return { axe: 'risques', feu, valeur: total, raison: null };
}
