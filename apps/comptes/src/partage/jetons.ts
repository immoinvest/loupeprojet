/** Identifiants et jetons des liens de partage : tirés au sort, jamais devinables. */

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
/** 62 × 4 : un octet au-dessus est rejeté, pour que chaque caractère ait la même chance. */
const PLAFOND_SANS_BIAIS = 248;

export const LONGUEUR_IDENTIFIANT = 8;
const OCTETS_JETON = 32;

export type Aleatoire = (nombre: number) => Uint8Array;

export const aleatoireCrypto: Aleatoire = (nombre) =>
  crypto.getRandomValues(new Uint8Array(nombre));

/** 8 caractères base62, tirés sans biais. */
export function nouvelIdentifiant(aleatoire: Aleatoire = aleatoireCrypto): string {
  let identifiant = '';
  while (identifiant.length < LONGUEUR_IDENTIFIANT) {
    for (const octet of aleatoire(LONGUEUR_IDENTIFIANT)) {
      if (octet < PLAFOND_SANS_BIAIS && identifiant.length < LONGUEUR_IDENTIFIANT) {
        identifiant += BASE62.charAt(octet % BASE62.length);
      }
    }
  }
  return identifiant;
}

/** Le jeton de suppression : 32 octets aléatoires en base64url (43 caractères). */
export function nouveauJeton(aleatoire: Aleatoire = aleatoireCrypto): string {
  let binaire = '';
  for (const octet of aleatoire(OCTETS_JETON)) binaire += String.fromCharCode(octet);
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** SHA-256 d'un texte, en hexadécimal. */
export async function empreinte(texte: string): Promise<string> {
  const octets = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte));
  return Array.from(new Uint8Array(octets), (o) => o.toString(16).padStart(2, '0')).join('');
}
