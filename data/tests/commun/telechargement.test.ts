import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import type { Contexte } from '../../src/commun/contexte.ts';
import { collecter } from '../../src/commun/flux.ts';
import { creerJournal } from '../../src/commun/journal.ts';
import {
  ErreurTelechargement,
  existe,
  ouvrir,
  telechargerJson,
  telechargerTexte,
  telechargerTexteEnFlux,
} from '../../src/commun/telechargement.ts';

type Reponse = (url: string, init: RequestInit | undefined) => Response | Promise<Response>;

interface FauxContexte {
  readonly contexte: Contexte;
  readonly pauses: number[];
  readonly journal: string[];
  readonly appels: { url: string; methode: string }[];
}

function fauxContexte(repondre: Reponse): FauxContexte {
  const pauses: number[] = [];
  const journal: string[] = [];
  const appels: { url: string; methode: string }[] = [];
  const recuperer = (async (entree: string | URL | Request, init?: RequestInit) => {
    const url = entree instanceof Request ? entree.url : String(entree);
    appels.push({ url, methode: init?.method ?? 'GET' });
    return repondre(url, init);
  }) as typeof fetch;
  const contexte: Contexte = {
    recuperer,
    pause: (millisecondes) => {
      pauses.push(millisecondes);
      return Promise.resolve();
    },
    horloge: () => new Date('2026-09-13T10:00:00Z'),
    journal: creerJournal({
      ecrire: (ligne) => journal.push(ligne),
      horloge: () => new Date('2026-09-13T10:00:00Z'),
      annotationsGitHub: false,
    }),
    dossierSortie: 'dist',
  };
  return { contexte, pauses, journal, appels };
}

describe('ouvrir', () => {
  it("rend la réponse dès qu'elle est bonne", async () => {
    const faux = fauxContexte(() => new Response('ok'));
    const reponse = await ouvrir('https://exemple.test/a', faux.contexte);
    expect(await reponse.text()).toBe('ok');
    expect(faux.pauses).toEqual([]);
  });

  it('réessaie après une erreur 5xx, avec une pause croissante et un avertissement', async () => {
    let appel = 0;
    const faux = fauxContexte(() => {
      appel += 1;
      return appel < 3 ? new Response('indisponible', { status: 503 }) : new Response('ok');
    });
    const reponse = await ouvrir('https://exemple.test/a', faux.contexte);
    expect(await reponse.text()).toBe('ok');
    expect(faux.pauses).toEqual([2000, 4000]);
    expect(faux.journal).toHaveLength(2);
    expect(faux.journal[0]).toContain('"tentative":1');
    expect(faux.journal[0]).toContain('HTTP 503');
  });

  it('abandonne après trois tentatives', async () => {
    const faux = fauxContexte(() => new Response('', { status: 502 }));
    await expect(ouvrir('https://exemple.test/a', faux.contexte)).rejects.toMatchObject({
      name: 'ErreurTelechargement',
      statut: 502,
      url: 'https://exemple.test/a',
    });
    expect(faux.appels).toHaveLength(3);
  });

  it('ne réessaie pas une erreur 4xx', async () => {
    const faux = fauxContexte(() => new Response('', { status: 404 }));
    await expect(ouvrir('https://exemple.test/a', faux.contexte)).rejects.toBeInstanceOf(
      ErreurTelechargement,
    );
    expect(faux.appels).toHaveLength(1);
    expect(faux.pauses).toEqual([]);
  });

  it("réessaie une erreur réseau et enveloppe une cause qui n'est pas une Error", async () => {
    let appel = 0;
    const faux = fauxContexte(() => {
      appel += 1;
      if (appel === 1) {
        throw new Error('connexion coupée');
      }
      if (appel === 2) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'panne';
      }
      return new Response('ok');
    });
    expect(await (await ouvrir('https://exemple.test/a', faux.contexte)).text()).toBe('ok');
    expect(faux.journal[0]).toContain('connexion coupée');
    expect(faux.journal[1]).toContain('panne');
  });
});

describe('telechargerTexte et telechargerJson', () => {
  it('rendent le corps en texte ou en JSON', async () => {
    const faux = fauxContexte((url) =>
      url.endsWith('.json') ? Response.json({ a: 1 }) : new Response('bonjour'),
    );
    expect(await telechargerTexte('https://exemple.test/a.txt', faux.contexte)).toBe('bonjour');
    expect(await telechargerJson('https://exemple.test/a.json', faux.contexte)).toEqual({ a: 1 });
  });
});

describe('telechargerTexteEnFlux', () => {
  it('décompresse un gzip et décode en UTF-8', async () => {
    const contenu = 'id,nom\n1,Été\n';
    const faux = fauxContexte(() => new Response(gzipSync(Buffer.from(contenu, 'utf8'))));
    const morceaux = await collecter(
      telechargerTexteEnFlux('https://exemple.test/a.csv.gz', faux.contexte, {
        gzip: true,
        encodage: 'utf-8',
      }),
    );
    expect(morceaux.join('')).toBe(contenu);
  });

  it('décode un fichier brut en Windows-1252', async () => {
    const faux = fauxContexte(() => new Response(Buffer.from([0x42, 0xe2, 0x74, 0x69, 0x65])));
    const morceaux = await collecter(
      telechargerTexteEnFlux('https://exemple.test/a.csv', faux.contexte, {
        gzip: false,
        encodage: 'windows-1252',
      }),
    );
    expect(morceaux.join('')).toBe('Bâtie');
  });

  it('ne rend rien pour une réponse sans corps', async () => {
    const faux = fauxContexte(() => new Response(null));
    const morceaux = await collecter(
      telechargerTexteEnFlux('https://exemple.test/vide', faux.contexte, {
        gzip: false,
        encodage: 'utf-8',
      }),
    );
    expect(morceaux).toEqual([]);
  });
});

describe('existe', () => {
  it('sonde par HEAD et rend vrai sur 2xx, faux sinon', async () => {
    const faux = fauxContexte((url) =>
      url.endsWith('2025.csv.gz') ? new Response(null) : new Response(null, { status: 404 }),
    );
    expect(await existe('https://exemple.test/2025.csv.gz', faux.contexte)).toBe(true);
    expect(await existe('https://exemple.test/2026.csv.gz', faux.contexte)).toBe(false);
    expect(faux.appels.map((appel) => appel.methode)).toEqual(['HEAD', 'HEAD']);
  });
});
