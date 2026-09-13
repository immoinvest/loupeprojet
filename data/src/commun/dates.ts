/** Dates calendaires au format ISO (AAAA-MM-JJ), toujours en temps universel. */

import { elementA } from './listes.ts';

interface DateDecomposee {
  readonly annee: number;
  readonly mois: number;
  readonly jour: number;
}

export function dateIso(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

function decomposer(date: string): DateDecomposee {
  const correspondance = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (correspondance === null) {
    throw new RangeError(`date ISO attendue (AAAA-MM-JJ) : ${date}`);
  }
  return {
    annee: Number(correspondance[1]),
    mois: Number(correspondance[2]),
    jour: Number(correspondance[3]),
  };
}

export function ajouterJours(date: string, jours: number): string {
  const { annee, mois, jour } = decomposer(date);
  return dateIso(new Date(Date.UTC(annee, mois - 1, jour + jours)));
}

export function decalerMois(date: string, mois: number): string {
  const decomposee = decomposer(date);
  return dateIso(new Date(Date.UTC(decomposee.annee, decomposee.mois - 1 + mois, decomposee.jour)));
}

/** Premier jour d'une fenêtre de `mois` mois se terminant à `fin` inclus : 2025-12-31 sur 24 mois → 2024-01-01. */
export function debutFenetre(fin: string, mois: number): string {
  return ajouterJours(decalerMois(fin, -mois), 1);
}

/** Trimestre civil d'une date : 2026-09-13 → 2026-T3. */
export function trimestreDe(date: string): string {
  const { annee, mois } = decomposer(date);
  return `${String(annee)}-T${String(Math.ceil(mois / 3))}`;
}

/** Premier jour d'un trimestre : 2026-T3 → 2026-07-01. */
export function debutTrimestre(trimestre: string): string {
  const correspondance = /^(\d{4})-T([1-4])$/.exec(trimestre);
  if (correspondance === null) {
    throw new RangeError(`trimestre attendu (AAAA-Tn) : ${trimestre}`);
  }
  const mois = (Number(correspondance[2]) - 1) * 3 + 1;
  return `${elementA(correspondance, 1)}-${String(mois).padStart(2, '0')}-01`;
}

export function trimestreSuivant(trimestre: string): string {
  return trimestreDe(decalerMois(debutTrimestre(trimestre), 3));
}
