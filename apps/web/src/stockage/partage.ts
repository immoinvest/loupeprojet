import { decoderJson, encoderJson } from './base64url';
import { ProjetEnregistreSchema, migrerEnregistre, type ProjetEnregistre } from './projets';

/**
 * Partage sans compte : le projet enregistré, entier, encodé en base64url dans le fragment
 * de l'URL (`/partage#p=…`). Le fragment n'est jamais envoyé au serveur ; rien n'est stocké.
 */

export const CHEMIN_PARTAGE = '/partage';
const PARAMETRE = 'p';

export type Decodage =
  | { readonly ok: true; readonly enregistre: ProjetEnregistre }
  | { readonly ok: false; readonly raison: 'vide' | 'illisible' | 'invalide' };

/** `ProjetEnregistre` → texte sûr pour une URL (base64url d'un JSON UTF-8). */
export function encoderPartage(enregistre: ProjetEnregistre): string {
  return encoderJson(enregistre);
}

/** Texte d'un lien → projet validé par Zod ; jamais d'exception. */
export function decoderPartage(texte: string): Decodage {
  const nettoye = texte.trim();
  if (nettoye === '') return { ok: false, raison: 'vide' };
  const lecture = decoderJson(nettoye);
  if (!lecture.ok) return { ok: false, raison: 'illisible' };
  const resultat = ProjetEnregistreSchema.safeParse(migrerEnregistre(lecture.valeur));
  return resultat.success
    ? { ok: true, enregistre: resultat.data }
    : { ok: false, raison: 'invalide' };
}

/** Le lien complet : `https://loupe.app/partage#p=…`. */
export function lienPartage(origine: string, enregistre: ProjetEnregistre): string {
  return `${origine}${CHEMIN_PARTAGE}#${PARAMETRE}=${encoderPartage(enregistre)}`;
}

/** Extrait le texte encodé d'un fragment d'URL (`#p=…`) ; `null` s'il n'y en a pas. */
export function lireFragment(hash: string): string | null {
  const parametres = new URLSearchParams(hash.replace(/^#/, ''));
  return parametres.get(PARAMETRE);
}
