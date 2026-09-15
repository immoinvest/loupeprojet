import { alleger } from '@loupe/projets';

import { decoderJson, encoderJson } from './base64url';
import { compresserJson, decompresserJson } from './compression';
import { ProjetEnregistreSchema, migrerEnregistre, type ProjetEnregistre } from './projets';

/**
 * Partage d'un projet, trois formes de lien (ADR-009) :
 * - court `/p/<id>` : une copie du projet allégé, gardée par l'API des comptes ;
 * - compressé `/partage#z=…` : le repli sans serveur, projet allégé compressé dans le fragment ;
 * - complet `/partage#p=…` : l'ancien format, projet entier en base64url, toujours lu.
 * Un fragment n'est jamais envoyé au serveur.
 */

export const CHEMIN_PARTAGE = '/partage';
export const CHEMIN_PARTAGE_COURT = '/p';
const PARAMETRE = 'p';
const PARAMETRE_COMPRESSE = 'z';

export type Decodage =
  | { readonly ok: true; readonly enregistre: ProjetEnregistre }
  | { readonly ok: false; readonly raison: 'vide' | 'illisible' | 'invalide' };

/** Une valeur JSON reçue → projet migré puis validé par Zod. */
export function validerPartage(valeur: unknown): Decodage {
  const resultat = ProjetEnregistreSchema.safeParse(migrerEnregistre(valeur));
  return resultat.success
    ? { ok: true, enregistre: resultat.data }
    : { ok: false, raison: 'invalide' };
}

/** `ProjetEnregistre` → texte sûr pour une URL (base64url d'un JSON UTF-8). */
export function encoderPartage(enregistre: ProjetEnregistre): string {
  return encoderJson(enregistre);
}

/** Texte d'un lien `#p=` → projet validé par Zod ; jamais d'exception. */
export function decoderPartage(texte: string): Decodage {
  const nettoye = texte.trim();
  if (nettoye === '') return { ok: false, raison: 'vide' };
  const lecture = decoderJson(nettoye);
  return lecture.ok ? validerPartage(lecture.valeur) : { ok: false, raison: 'illisible' };
}

/** Texte d'un lien `#z=` → projet validé par Zod ; jamais d'exception. */
export async function decoderPartageCompresse(texte: string): Promise<Decodage> {
  const nettoye = texte.trim();
  if (nettoye === '') return { ok: false, raison: 'vide' };
  const lecture = await decompresserJson(nettoye);
  return lecture.ok ? validerPartage(lecture.valeur) : { ok: false, raison: 'illisible' };
}

/** L'ancien lien complet : `https://…/partage#p=…`. */
export function lienPartage(origine: string, enregistre: ProjetEnregistre): string {
  return `${origine}${CHEMIN_PARTAGE}#${PARAMETRE}=${encoderPartage(enregistre)}`;
}

/** Le lien court : `https://…/p/7fK2qA9x`. */
export function lienPartageCourt(origine: string, id: string): string {
  return `${origine}${CHEMIN_PARTAGE_COURT}/${id}`;
}

/** Le lien de repli : projet allégé (sans la visite), compressé dans le fragment. */
export async function lienPartageCompresse(
  origine: string,
  enregistre: ProjetEnregistre,
): Promise<string> {
  return `${origine}${CHEMIN_PARTAGE}#${PARAMETRE_COMPRESSE}=${await compresserJson(alleger(enregistre))}`;
}

/** Extrait le texte encodé d'un fragment d'URL (`#p=…`) ; `null` s'il n'y en a pas. */
export function lireFragment(hash: string): string | null {
  const parametres = new URLSearchParams(hash.replace(/^#/, ''));
  return parametres.get(PARAMETRE);
}

export interface FragmentPartage {
  readonly format: 'complet' | 'compresse';
  readonly texte: string;
}

/** Le fragment d'une page `/partage` : complet (`#p=`) ou compressé (`#z=`) ; `null` sans l'un ni l'autre. */
export function lireFragmentPartage(hash: string): FragmentPartage | null {
  const parametres = new URLSearchParams(hash.replace(/^#/, ''));
  const complet = parametres.get(PARAMETRE);
  if (complet !== null) return { format: 'complet', texte: complet };
  const compresse = parametres.get(PARAMETRE_COMPRESSE);
  return compresse === null ? null : { format: 'compresse', texte: compresse };
}
