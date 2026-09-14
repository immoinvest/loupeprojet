import {
  SimulationPretSchema,
  type SimulationPret,
  type SimulationPretEntree,
} from '@loupe/moteur';

import { decoderJson, encoderJson } from '@/stockage/base64url';

/**
 * Le lien d'une simulation : `/simulateur-pret#s=<base64url du JSON>`. Le fragment n'est
 * jamais envoyé au serveur. Une simulation partielle (prix, taux, durée) est complétée par
 * les défauts du schéma : c'est le contrat du futur bouton « Simuler un prêt » d'un projet.
 */

export const CHEMIN_SIMULATEUR = '/simulateur-pret';
export const CHEMIN_IMPRESSION = `${CHEMIN_SIMULATEUR}/imprimer`;
export const PARAMETRE = 's';

export type RaisonLien = 'vide' | 'illisible' | 'invalide';

export type DecodageSimulation =
  | { readonly ok: true; readonly simulation: SimulationPret }
  | { readonly ok: false; readonly raison: RaisonLien };

export function encoderSimulation(simulation: SimulationPretEntree): string {
  return encoderJson(simulation);
}

/** Texte encodé → simulation validée par Zod ; jamais d'exception. */
export function decoderSimulation(texte: string): DecodageSimulation {
  const nettoye = texte.trim();
  if (nettoye === '') return { ok: false, raison: 'vide' };
  let brut: unknown;
  try {
    brut = decoderJson(nettoye);
  } catch {
    return { ok: false, raison: 'illisible' };
  }
  const resultat = SimulationPretSchema.safeParse(brut);
  return resultat.success
    ? { ok: true, simulation: resultat.data }
    : { ok: false, raison: 'invalide' };
}

/** `#s=…`, à coller après un chemin. */
export function fragmentSimulation(simulation: SimulationPretEntree): string {
  return `#${PARAMETRE}=${encoderSimulation(simulation)}`;
}

/** Le lien complet : `https://deklic.app/simulateur-pret#s=…`. */
export function lienSimulateur(origine: string, simulation: SimulationPretEntree): string {
  return `${origine}${CHEMIN_SIMULATEUR}${fragmentSimulation(simulation)}`;
}

/** Extrait le texte encodé d'un fragment d'URL (`#s=…`) ; `null` s'il n'y en a pas. */
export function lireFragmentSimulation(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, '')).get(PARAMETRE);
}
