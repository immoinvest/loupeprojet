/**
 * Décisions du service worker (src/sw/service-worker.ts), en fonctions pures : quelle requête passe
 * par le cache, quels fichiers forment la coque de l'application, quels caches sont périmés.
 */

/**
 * `navigation` : réseau d'abord, repli sur la coque en cache ; `coque-d-abord` : la coque en cache,
 * le réseau seulement sans elle (annonce partagée) ; `cache-d-abord` : fichiers construits, dont le
 * nom change à chaque version ; `reseau-d-abord` : manifeste et icônes ; `ignorer` : le navigateur
 * fait comme sans service worker.
 */
export type Strategie =
  'navigation' | 'coque-d-abord' | 'cache-d-abord' | 'reseau-d-abord' | 'ignorer';

/** Ce que le service worker lit d'une requête interceptée. */
export interface RequeteInterceptee {
  readonly url: string;
  readonly methode: string;
  readonly mode: string;
}

const PREFIXE_CACHE = 'deklic-';
const CHEMIN_ASSETS = '/assets/';

/**
 * API des comptes, servie par le worker Pages sur la même origine : jamais par le service worker,
 * pas même une navigation (retour de Google ou d'Apple), qui remplacerait la coque en cache.
 */
const CHEMIN_API = '/api/';

/**
 * Cible de partage du manifeste (`share_target.action`) : l'annonce partagée arrive dans l'adresse.
 * Servie par la coque en cache, elle reste sur l'appareil au lieu de passer par le serveur.
 */
export const ACTION_PARTAGE = '/projets/nouveau';

/** Toujours au réseau : le bouton-favori doit rester à jour, le service worker aussi. */
const JAMAIS_EN_CACHE: ReadonlySet<string> = new Set(['/capture.js', '/sw.js']);

/** Fichiers publics de la coque, mis en cache à l'installation avec la page. */
export const FICHIERS_FIXES: readonly string[] = [
  '/manifest.webmanifest',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
];

export function strategiePour(requete: RequeteInterceptee, origine: string): Strategie {
  if (requete.methode !== 'GET') return 'ignorer';
  let url: URL;
  try {
    url = new URL(requete.url);
  } catch {
    return 'ignorer';
  }
  // Worker d'enrichissement, polices, portails, API des comptes : jamais interceptés.
  if (
    url.origin !== origine ||
    JAMAIS_EN_CACHE.has(url.pathname) ||
    url.pathname.startsWith(CHEMIN_API)
  ) {
    return 'ignorer';
  }
  if (requete.mode === 'navigate') {
    return url.pathname === ACTION_PARTAGE && url.search !== '' ? 'coque-d-abord' : 'navigation';
  }
  if (url.pathname.startsWith(CHEMIN_ASSETS)) return 'cache-d-abord';
  return FICHIERS_FIXES.includes(url.pathname) ? 'reseau-d-abord' : 'ignorer';
}

/**
 * Seule une page HTML peut devenir la coque gardée hors ligne : un fichier ouvert directement dans un
 * onglet (icône, manifeste) la remplacerait sinon, et Deklic s'ouvrirait sur ce fichier sans réseau.
 */
export function estUnePage(typeDeContenu: string | null): boolean {
  return typeDeContenu?.split(';')[0]?.trim().toLowerCase() === 'text/html';
}

const ATTRIBUT_ASSET = /\b(?:src|href)="(\/assets\/[^"?#]+)"/g;

/** Scripts et styles construits que la page référence (`/assets/…`), sans doublon. */
export function fichiersDeLaCoque(html: string): string[] {
  const chemins = Array.from(html.matchAll(ATTRIBUT_ASSET), (correspondance) => correspondance[1]);
  return [...new Set(chemins.filter((chemin): chemin is string => chemin !== undefined))];
}

/** Nom du cache d'une version de l'application. */
export function nomDuCache(version: string): string {
  return `${PREFIXE_CACHE}${version}`;
}

/** Caches d'une autre version de Deklic, à supprimer ; ceux d'autres applications restent. */
export function cachesPerimes(noms: readonly string[], courant: string): string[] {
  return noms.filter((nom) => nom.startsWith(PREFIXE_CACHE) && nom !== courant);
}
