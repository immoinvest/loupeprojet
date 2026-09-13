import { CaptureSchema, type Capture } from './schema';

/** Nom du paramètre dans le fragment : `#capture=…`. */
export const CLE_FRAGMENT = 'capture';

/** Chemin de l'écran qui lit une capture. */
export const CHEMIN_NOUVEAU_PROJET = '/projets/nouveau';

function versBase64Url(octets: Uint8Array): string {
  let binaire = '';
  for (const octet of octets) binaire += String.fromCharCode(octet);
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function depuisBase64Url(texte: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(texte)) return null;
  const base64 = texte.replace(/-/g, '+').replace(/_/g, '/');
  const rembourrage = '='.repeat((4 - (base64.length % 4)) % 4);
  try {
    return Uint8Array.from(atob(base64 + rembourrage), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Capture → texte sûr pour un fragment d'URL : base64url (sans `=`) du JSON en UTF-8. */
export function encoderCapture(capture: Capture): string {
  return versBase64Url(new TextEncoder().encode(JSON.stringify(capture)));
}

export type RaisonDecodage = 'encodage' | 'json' | 'schema';

export type ResultatDecodage =
  | { readonly ok: true; readonly capture: Capture }
  | { readonly ok: false; readonly raison: RaisonDecodage };

/** Inverse d'`encoderCapture`. Ne lève jamais : un fragment forgé ou tronqué donne une raison. */
export function decoderCapture(texte: string): ResultatDecodage {
  const octets = depuisBase64Url(texte);
  if (octets === null) return { ok: false, raison: 'encodage' };
  let brut: unknown;
  try {
    brut = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(octets));
  } catch {
    return { ok: false, raison: 'json' };
  }
  const resultat = CaptureSchema.safeParse(brut);
  return resultat.success ? { ok: true, capture: resultat.data } : { ok: false, raison: 'schema' };
}

/** `https://loupeprojet.pages.dev` + capture → `https://loupeprojet.pages.dev/projets/nouveau#capture=…`. */
export function urlDeCapture(base: string, capture: Capture): string {
  const origine = base.replace(/\/+$/, '');
  return `${origine}${CHEMIN_NOUVEAU_PROJET}#${CLE_FRAGMENT}=${encoderCapture(capture)}`;
}

/** Lit `#capture=…` d'un `location.hash` ; `null` si le fragment ne porte pas de capture. */
export function captureDepuisHash(hash: string): ResultatDecodage | null {
  const valeur = new URLSearchParams(hash.replace(/^#/, '')).get(CLE_FRAGMENT);
  return valeur === null ? null : decoderCapture(valeur);
}
