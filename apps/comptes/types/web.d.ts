import type { webcrypto } from 'node:crypto';

// Better Auth et @better-fetch/fetch citent des types globaux du navigateur (WebCrypto, options de
// fetch) que les types de Node n'exposent pas globalement. Sans ces alias, typescript-eslint voit des
// types « error » dans les plugins. Les Workers ont ces globaux ; ce fichier ne sert qu'au typage.
declare global {
  type CryptoKey = webcrypto.CryptoKey;
  type JsonWebKey = webcrypto.JsonWebKey;
  type RequestCache =
    'default' | 'force-cache' | 'no-cache' | 'no-store' | 'only-if-cached' | 'reload';
  type RequestCredentials = 'include' | 'omit' | 'same-origin';
  type RequestMode = 'cors' | 'navigate' | 'no-cors' | 'same-origin';
  type RequestPriority = 'auto' | 'high' | 'low';
  type RequestRedirect = 'error' | 'follow' | 'manual';
  type ReferrerPolicy =
    | ''
    | 'no-referrer'
    | 'no-referrer-when-downgrade'
    | 'origin'
    | 'origin-when-cross-origin'
    | 'same-origin'
    | 'strict-origin'
    | 'strict-origin-when-cross-origin'
    | 'unsafe-url';
}

export {};
