/**
 * Service worker de Deklic, construit par vite.hors-ligne.config.ts vers dist/sw.js. Colle autour
 * de hors-ligne/strategie.ts : chaque décision y est une fonction pure testée ; ici, seulement les
 * appels au cache et au réseau. Hors couverture unitaire, prouvé par e2e/hors-ligne.spec.ts.
 */
import {
  FICHIERS_FIXES,
  cachesPerimes,
  estUnePage,
  fichiersDeLaCoque,
  nomDuCache,
  strategiePour,
  type Strategie,
} from '../hors-ligne/strategie';

/** Empreinte de dist/index.html, injectée au build : elle change quand l'application change. */
declare const __VERSION_HORS_LIGNE__: string;

/* Types locaux du service worker : ce fichier est vérifié avec les types du DOM de l'application. */
interface EvenementEtendu extends Event {
  readonly waitUntil: (promesse: Promise<unknown>) => void;
}

interface EvenementFetch extends EvenementEtendu {
  readonly request: Request;
  readonly respondWith: (reponse: Promise<Response>) => void;
}

interface PorteeServiceWorker {
  readonly location: { readonly origin: string };
  readonly clients: { readonly claim: () => Promise<void> };
  readonly skipWaiting: () => Promise<void>;
  readonly addEventListener: {
    (type: 'install' | 'activate', ecouteur: (evenement: EvenementEtendu) => void): void;
    (type: 'fetch', ecouteur: (evenement: EvenementFetch) => void): void;
  };
}

const portee = self as unknown as PorteeServiceWorker;
const CACHE = nomDuCache(__VERSION_HORS_LIGNE__);
/** La page de l'application : toutes les routes servent la même, le routeur fait le reste. */
const COQUE = '/';

async function mettreEnCache(cle: Request | string, reponse: Response): Promise<void> {
  // Une redirection mise en cache casserait une navigation ultérieure.
  if (!reponse.ok || reponse.redirected) return;
  const cache = await caches.open(CACHE);
  await cache.put(cle, reponse);
}

/**
 * Lecture du cache sans tenir compte de `Vary` : les scripts modules de la page envoient un en-tête
 * `Origin` que les requêtes de pré-mise en cache n'ont pas, et un serveur qui répond `Vary: Origin`
 * rendrait le cache introuvable hors ligne. Chaque adresse mise en cache désigne un fichier unique.
 */
const LECTURE = { cacheName: CACHE, ignoreVary: true } as const;

async function depuisLeCache(cle: Request | string): Promise<Response> {
  return (await caches.match(cle, LECTURE)) ?? Response.error();
}

async function preparer(): Promise<void> {
  const cache = await caches.open(CACHE);
  const page = await fetch(COQUE, { cache: 'no-cache' });
  const html = await page.clone().text();
  await cache.put(COQUE, page);
  await cache.addAll([...fichiersDeLaCoque(html), ...FICHIERS_FIXES]);
  await portee.skipWaiting();
}

async function nettoyer(): Promise<void> {
  const perimes = cachesPerimes(await caches.keys(), CACHE);
  await Promise.all(perimes.map((nom) => caches.delete(nom)));
  await portee.clients.claim();
}

const REPONDRE: Readonly<
  Record<Exclude<Strategie, 'ignorer'>, (requete: Request) => Promise<Response>>
> = {
  navigation: async (requete) => {
    try {
      const reponse = await fetch(requete);
      if (estUnePage(reponse.headers.get('content-type'))) {
        await mettreEnCache(COQUE, reponse.clone());
      }
      return reponse;
    } catch {
      return depuisLeCache(COQUE);
    }
  },
  // Annonce partagée : la coque en cache, pour que le texte partagé ne quitte pas l'appareil.
  'coque-d-abord': async (requete) => (await caches.match(COQUE, LECTURE)) ?? fetch(requete),
  'cache-d-abord': async (requete) => {
    const trouvee = await caches.match(requete, LECTURE);
    if (trouvee !== undefined) return trouvee;
    const reponse = await fetch(requete);
    await mettreEnCache(requete, reponse.clone());
    return reponse;
  },
  'reseau-d-abord': async (requete) => {
    try {
      const reponse = await fetch(requete);
      await mettreEnCache(requete, reponse.clone());
      return reponse;
    } catch {
      return depuisLeCache(requete);
    }
  },
};

portee.addEventListener('install', (evenement) => {
  evenement.waitUntil(preparer());
});

portee.addEventListener('activate', (evenement) => {
  evenement.waitUntil(nettoyer());
});

portee.addEventListener('fetch', (evenement) => {
  const { request } = evenement;
  const strategie = strategiePour(
    { url: request.url, methode: request.method, mode: request.mode },
    portee.location.origin,
  );
  if (strategie === 'ignorer') return;
  evenement.respondWith(REPONDRE[strategie](request));
});
