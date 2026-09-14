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

function versBase64Url(octets: Uint8Array): string {
  let binaire = '';
  for (const octet of octets) binaire += String.fromCharCode(octet);
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function depuisBase64Url(texte: string): Uint8Array {
  const base64 = texte.replace(/-/g, '+').replace(/_/g, '/');
  const complement = '='.repeat((4 - (base64.length % 4)) % 4);
  const binaire = atob(base64 + complement);
  return Uint8Array.from(binaire, (c) => c.charCodeAt(0));
}

/** `ProjetEnregistre` → texte sûr pour une URL (base64url d'un JSON UTF-8). */
export function encoderPartage(enregistre: ProjetEnregistre): string {
  return versBase64Url(new TextEncoder().encode(JSON.stringify(enregistre)));
}

/** Texte d'un lien → projet validé par Zod ; jamais d'exception. */
export function decoderPartage(texte: string): Decodage {
  const nettoye = texte.trim();
  if (nettoye === '') return { ok: false, raison: 'vide' };
  let brut: unknown;
  try {
    brut = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(depuisBase64Url(nettoye)));
  } catch {
    return { ok: false, raison: 'illisible' };
  }
  const resultat = ProjetEnregistreSchema.safeParse(migrerEnregistre(brut));
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
