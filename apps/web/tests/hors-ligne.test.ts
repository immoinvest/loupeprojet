import { describe, expect, it, vi } from 'vitest';

import {
  FICHIERS_FIXES,
  URL_SERVICE_WORKER,
  cachesPerimes,
  enregistrerServiceWorker,
  fichiersDeLaCoque,
  nomDuCache,
  strategiePour,
} from '@/hors-ligne';

const ORIGINE = 'https://loupeprojet.pages.dev';

function requete(
  chemin: string,
  options: { methode?: string; mode?: string } = {},
): {
  url: string;
  methode: string;
  mode: string;
} {
  return {
    url: chemin.startsWith('http') ? chemin : `${ORIGINE}${chemin}`,
    methode: options.methode ?? 'GET',
    mode: options.mode ?? 'cors',
  };
}

describe('strategiePour', () => {
  it('navigation de même origine, même profonde : réseau d’abord, repli sur la coque', () => {
    expect(strategiePour(requete('/', { mode: 'navigate' }), ORIGINE)).toBe('navigation');
    expect(strategiePour(requete('/projets/abc/fiscalite', { mode: 'navigate' }), ORIGINE)).toBe(
      'navigation',
    );
  });

  it('fichiers construits : cache d’abord ; manifeste et icônes : réseau d’abord', () => {
    expect(strategiePour(requete('/assets/index-3f2a.js'), ORIGINE)).toBe('cache-d-abord');
    expect(strategiePour(requete('/icon-192.png'), ORIGINE)).toBe('reseau-d-abord');
    expect(strategiePour(requete('/manifest.webmanifest'), ORIGINE)).toBe('reseau-d-abord');
  });

  it('ignore les autres origines, les autres méthodes, le bouton-favori et le service worker', () => {
    expect(strategiePour(requete('https://deklic-api.workers.dev/extract'), ORIGINE)).toBe(
      'ignorer',
    );
    expect(strategiePour(requete('https://fonts.gstatic.com/s/outfit.woff2'), ORIGINE)).toBe(
      'ignorer',
    );
    expect(strategiePour(requete('/assets/index.js', { methode: 'POST' }), ORIGINE)).toBe(
      'ignorer',
    );
    expect(strategiePour(requete('/capture.js'), ORIGINE)).toBe('ignorer');
    expect(strategiePour(requete('/sw.js', { mode: 'navigate' }), ORIGINE)).toBe('ignorer');
  });

  it('ignore un chemin inconnu et une URL illisible', () => {
    expect(strategiePour(requete('/_redirects'), ORIGINE)).toBe('ignorer');
    expect(strategiePour({ url: 'pas une url', methode: 'GET', mode: 'cors' }, ORIGINE)).toBe(
      'ignorer',
    );
  });
});

describe('fichiersDeLaCoque', () => {
  it('relève scripts et styles construits, sans doublon', () => {
    const html = `<!doctype html><html><head>
      <script type="module" crossorigin src="/assets/index-3f2a.js"></script>
      <link rel="modulepreload" crossorigin href="/assets/vendor-9c1b.js">
      <link rel="stylesheet" crossorigin href="/assets/index-77aa.css">
      <link rel="modulepreload" href="/assets/vendor-9c1b.js">
    </head></html>`;
    expect(fichiersDeLaCoque(html)).toEqual([
      '/assets/index-3f2a.js',
      '/assets/vendor-9c1b.js',
      '/assets/index-77aa.css',
    ]);
  });

  it('ignore ce qui n’est pas sous /assets/, les autres origines et une page sans fichier', () => {
    const html = `<link rel="icon" href="/favicon.svg">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit">
      <script src="https://cdn.example.com/assets/x.js"></script>`;
    expect(fichiersDeLaCoque(html)).toEqual([]);
    expect(fichiersDeLaCoque('')).toEqual([]);
  });
});

describe('caches', () => {
  it('nomme le cache par version et ne supprime que les autres versions de Deklic', () => {
    const courant = nomDuCache('a1b2c3');
    expect(courant).toBe('deklic-a1b2c3');
    expect(cachesPerimes([], courant)).toEqual([]);
    expect(cachesPerimes(['deklic-000000', courant, 'workbox-precache', 'autre'], courant)).toEqual(
      ['deklic-000000'],
    );
  });

  it('met en cache les icônes du manifeste', () => {
    expect(FICHIERS_FIXES).toContain('/manifest.webmanifest');
    expect(FICHIERS_FIXES).toContain('/icon-maskable-512.png');
  });
});

describe('enregistrerServiceWorker', () => {
  it('ne fait rien en développement ni sans service worker', () => {
    const register = vi.fn(() => Promise.resolve());
    const quandCharge = vi.fn();
    expect(
      enregistrerServiceWorker({ production: false, conteneur: { register }, quandCharge }),
    ).toBe(false);
    expect(enregistrerServiceWorker({ production: true, conteneur: undefined, quandCharge })).toBe(
      false,
    );
    expect(quandCharge).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });

  it('enregistre /sw.js une fois la page chargée, et survit à un refus', async () => {
    const register = vi.fn(() => Promise.reject(new Error('stockage plein')));
    let action: (() => void) | undefined;
    const lance = enregistrerServiceWorker({
      production: true,
      conteneur: { register },
      quandCharge: (a) => {
        action = a;
      },
    });
    expect(lance).toBe(true);
    expect(register).not.toHaveBeenCalled();

    action?.();
    expect(register).toHaveBeenCalledWith(URL_SERVICE_WORKER, { scope: '/' });
    // Le refus est absorbé : aucune promesse rejetée ne remonte.
    await Promise.resolve();
  });
});
