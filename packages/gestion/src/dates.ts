import { z } from 'zod';

/*
 * Jours civils « AAAA-MM-JJ » et mois « AAAA-MM », en texte : aucune heure, aucun fuseau. Deux
 * dates de ce format se comparent directement (`<`, `>=`), l'ordre du texte étant celui du calendrier.
 */

const FORMAT_JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;
const FORMAT_PERIODE = /^\d{4}-(0[1-9]|1[0-2])$/;
const MS_PAR_JOUR = 86_400_000;

function deuxChiffres(n: number): string {
  return String(n).padStart(2, '0');
}

/** Nombre de jours du mois (1 à 12) de l'année, années bissextiles comprises. */
export function joursDansMois(annee: number, mois: number): number {
  return new Date(Date.UTC(annee, mois, 0)).getUTCDate();
}

function estJourValide(texte: string): boolean {
  const morceaux = FORMAT_JOUR.exec(texte);
  if (morceaux === null) return false;
  const [annee, mois, jour] = morceaux.slice(1).map(Number) as [number, number, number];
  return mois >= 1 && mois <= 12 && jour >= 1 && jour <= joursDansMois(annee, mois);
}

export const JourSchema = z
  .string()
  .refine(estJourValide, { message: 'Date invalide (AAAA-MM-JJ)' });
export const PeriodeSchema = z
  .string()
  .regex(FORMAT_PERIODE, { message: 'Mois invalide (AAAA-MM)' });

/** « 2026-10-12 » → « 2026-10 ». */
export function periodeDe(jour: string): string {
  return jour.slice(0, 7);
}

export interface BornesPeriode {
  readonly debut: string;
  readonly fin: string;
  readonly jours: number;
}

/** Premier et dernier jour du mois, et son nombre de jours. */
export function bornesPeriode(periode: string): BornesPeriode {
  const annee = Number(periode.slice(0, 4));
  const mois = Number(periode.slice(5, 7));
  const jours = joursDansMois(annee, mois);
  return { debut: `${periode}-01`, fin: `${periode}-${deuxChiffres(jours)}`, jours };
}

function versJour(date: Date): string {
  return `${String(date.getUTCFullYear())}-${deuxChiffres(date.getUTCMonth() + 1)}-${deuxChiffres(date.getUTCDate())}`;
}

/** Le jour situé `nombre` jours plus tard (ou plus tôt si négatif). */
export function ajouterJours(jour: string, nombre: number): string {
  return versJour(new Date(Date.parse(`${jour}T00:00:00Z`) + nombre * MS_PAR_JOUR));
}

/** « 2026-12 » → « 2027-01 ». */
export function periodeSuivante(periode: string): string {
  return periodeDe(ajouterJours(bornesPeriode(periode).fin, 1));
}

/** « 2027-01 » → « 2026-12 ». */
export function periodePrecedente(periode: string): string {
  return periodeDe(ajouterJours(bornesPeriode(periode).debut, -1));
}

/** Le mois situé `nombre` mois plus tard, ou plus tôt si négatif : « 2026-11 » + 2 → « 2027-01 ». */
export function ajouterMois(periode: string, nombre: number): string {
  const rang = Number(periode.slice(0, 4)) * 12 + Number(periode.slice(5, 7)) - 1 + nombre;
  return `${String(Math.floor(rang / 12))}-${deuxChiffres((rang % 12) + 1)}`;
}

/** Le jour civil d'un instant dans le fuseau de l'appareil (celui de la personne, côté web). */
export function jourLocal(instant: Date): string {
  return `${String(instant.getFullYear())}-${deuxChiffres(instant.getMonth() + 1)}-${deuxChiffres(instant.getDate())}`;
}
