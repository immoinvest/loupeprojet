/**
 * Encodage base64url d'un JSON UTF-8, pour les fragments d'URL (`/partage#p=…`,
 * `/simulateur-pret#s=…`). Un fragment n'est jamais envoyé au serveur.
 */

export function versBase64Url(octets: Uint8Array): string {
  let binaire = '';
  for (const octet of octets) binaire += String.fromCharCode(octet);
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function depuisBase64Url(texte: string): Uint8Array {
  const base64 = texte.replace(/-/g, '+').replace(/_/g, '/');
  const complement = '='.repeat((4 - (base64.length % 4)) % 4);
  const binaire = atob(base64 + complement);
  return Uint8Array.from(binaire, (c) => c.charCodeAt(0));
}

/** Valeur JSON → texte sûr pour une URL. */
export function encoderJson(valeur: unknown): string {
  return versBase64Url(new TextEncoder().encode(JSON.stringify(valeur)));
}

export type LectureJson = { readonly ok: true; readonly valeur: unknown } | { readonly ok: false };

/** Texte d'un fragment → valeur JSON ; jamais d'exception (base64 abîmé, UTF-8 ou JSON invalide). */
export function decoderJson(texte: string): LectureJson {
  try {
    const json = new TextDecoder('utf-8', { fatal: true }).decode(depuisBase64Url(texte));
    return { ok: true, valeur: JSON.parse(json) as unknown };
  } catch {
    return { ok: false };
  }
}
