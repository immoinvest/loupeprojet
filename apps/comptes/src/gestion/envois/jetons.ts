import { normaliserEmail } from '@loupe/gestion';

import { empreinte } from '../../partage/jetons';

/** Signature et vérification des liens d'accord (ADR-G41) : `<id>.<expiration en secondes>.<signature>`. */
export interface SignatureJetons {
  signer(id: string, expirationMs: number): Promise<string>;
  /** L'identifiant du jeton si la signature est bonne et l'expiration pas atteinte, sinon `null`. */
  verifier(jeton: string, maintenantMs: number): Promise<string | null>;
}

const FORME = /^([A-Za-z0-9_-]{16,100})\.([0-9]{1,13})\.([A-Za-z0-9_-]{43})$/;

function versBase64url(octets: ArrayBuffer): string {
  let binaire = '';
  for (const octet of new Uint8Array(octets)) binaire += String.fromCharCode(octet);
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function depuisBase64url(texte: string): Uint8Array<ArrayBuffer> {
  const binaire = atob(`${texte.replace(/-/g, '+').replace(/_/g, '/')}=`);
  return Uint8Array.from(binaire, (c) => c.charCodeAt(0));
}

/** HMAC SHA-256 avec le secret `JETON_COURRIEL_SECRET` ; la vérification est à temps constant. */
export function signatureJetons(secret: string): SignatureJetons {
  const encodeur = new TextEncoder();
  let cle: Promise<CryptoKey> | undefined;
  const lireCle = (): Promise<CryptoKey> =>
    (cle ??= crypto.subtle.importKey(
      'raw',
      encodeur.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    ));

  return {
    async signer(id, expirationMs) {
      const donnees = `${id}.${String(Math.floor(expirationMs / 1000))}`;
      const signature = await crypto.subtle.sign('HMAC', await lireCle(), encodeur.encode(donnees));
      return `${donnees}.${versBase64url(signature)}`;
    },
    async verifier(jeton, maintenantMs) {
      const forme = FORME.exec(jeton);
      if (forme === null) return null;
      const [, id = '', secondes = '', signature = ''] = forme;
      const bonne = await crypto.subtle.verify(
        'HMAC',
        await lireCle(),
        depuisBase64url(signature),
        encodeur.encode(`${id}.${secondes}`),
      );
      if (!bonne) return null;
      return Number(secondes) * 1000 > maintenantMs ? id : null;
    },
  };
}

/** L'empreinte SHA-256 d'une adresse normalisée : seule forme gardée en base (ADR-G42). */
export function empreinteEmail(email: string): Promise<string> {
  return empreinte(normaliserEmail(email));
}
