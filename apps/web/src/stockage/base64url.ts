/**
 * Encodage d'une valeur JSON en texte sûr pour un fragment d'URL (base64url d'un JSON UTF-8),
 * partagé par le partage d'un projet (`/partage#p=…`) et le simulateur de prêt (`#s=…`).
 */

export function versBase64Url(octets: Uint8Array): string {
  let binaire = '';
  for (const octet of octets) binaire += String.fromCharCode(octet);
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Lève si le texte n'est pas du base64url. */
export function depuisBase64Url(texte: string): Uint8Array {
  const base64 = texte.replace(/-/g, '+').replace(/_/g, '/');
  const complement = '='.repeat((4 - (base64.length % 4)) % 4);
  const binaire = atob(base64 + complement);
  return Uint8Array.from(binaire, (c) => c.charCodeAt(0));
}

/** Valeur JSON → base64url. */
export function encoderJson(valeur: unknown): string {
  return versBase64Url(new TextEncoder().encode(JSON.stringify(valeur)));
}

/** base64url → valeur JSON inconnue ; lève si le texte n'est ni du base64url, ni de l'UTF-8, ni du JSON. */
export function decoderJson(texte: string): unknown {
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(depuisBase64Url(texte)));
}
