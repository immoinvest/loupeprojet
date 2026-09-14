import type { Portail } from '@loupe/capture';

export type EtapeAttente = 'contact' | 'reponse' | 'lecture' | 'details' | 'long';

/**
 * Durée habituelle d'une lecture par le serveur, relevée le 14/09/2026 et arrondie : Bien'ici est
 * lu directement ; les autres passent par Bright Data (Logic-Immo 2,5 à 9 s, PAP 5 à 17 s,
 * LeBonCoin 17 à 18 s, SeLoger 10 à 74 s).
 */
export const DUREES_HABITUELLES_MS: Readonly<Record<Portail, number>> = {
  bienici: 3_000,
  logicimmo: 10_000,
  pap: 15_000,
  leboncoin: 20_000,
  seloger: 45_000,
};

/** La barre n'atteint jamais la fin avant la réponse : elle ralentit et plafonne. */
export const PROGRESSION_MAX = 0.95;
/** À la durée habituelle, la barre est aux alentours de 85 %. */
const RAPIDITE = 2.2;

/** Fraction de la durée habituelle à partir de laquelle on passe à l'étape suivante. */
const ETAPES: readonly (readonly [number, EtapeAttente])[] = [
  [0.15, 'contact'],
  [0.45, 'reponse'],
  [0.8, 'lecture'],
  [1.5, 'details'],
];

export interface EtatAttente {
  /** Entre 0 et `PROGRESSION_MAX`, croissante. */
  readonly progression: number;
  readonly etape: EtapeAttente;
}

/** Où en est l'attente, d'après le temps écoulé et la durée habituelle du portail. */
export function etatAttente(ecouleMs: number, portail: Portail): EtatAttente {
  const fraction = Math.max(0, ecouleMs) / DUREES_HABITUELLES_MS[portail];
  const progression = PROGRESSION_MAX * (1 - Math.exp(-RAPIDITE * fraction));
  const etape = ETAPES.find(([seuil]) => fraction < seuil)?.[1] ?? 'long';
  return { progression, etape };
}

/** Une astuce toutes les 7 secondes. */
export const INTERVALLE_ASTUCE_MS = 7_000;

/** L'astuce à montrer après `ecouleMs` parmi `nombre`, en boucle. */
export function indiceAstuce(ecouleMs: number, nombre: number): number {
  if (nombre <= 0) return 0;
  return Math.floor(Math.max(0, ecouleMs) / INTERVALLE_ASTUCE_MS) % nombre;
}
