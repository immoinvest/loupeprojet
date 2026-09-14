import { describe, expect, it, vi } from 'vitest';

import { clientHorsLigne, clientWorker } from '@/enrichissement';
import { DELAI_LECTURE_PAGE_MS, signalDeRequete, type Fetch } from '@/enrichissement/client';

const URL_PAP = 'https://www.pap.fr/annonces/appartement-nice-06000-r463902045';
const REPONSE = {
  portail: 'pap',
  url: URL_PAP,
  page: { type: 'html', html: '<html></html>' },
  tentatives: 2,
  obtenuLe: '2026-09-14T12:00:00.000Z',
};

const repondre = (corps: unknown, statut = 200): Fetch =>
  vi.fn(() => Promise.resolve(new Response(JSON.stringify(corps), { status: statut })));

describe('client · lirePage', () => {
  it('POST /lecture avec le lien, réponse revalidée', async () => {
    const fetcher = repondre(REPONSE);
    const r = await clientWorker('https://worker.test', fetcher).lirePage(URL_PAP);
    expect(r).toEqual({ ok: true, valeur: REPONSE });
    expect(fetcher).toHaveBeenCalledWith(
      'https://worker.test/lecture',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ url: URL_PAP }) }),
    );
    expect(DELAI_LECTURE_PAGE_MS).toBeGreaterThan(140_000);
  });

  it('réponse hors contrat : REPONSE_INVALIDE ; erreur du Worker : son code ; hors ligne : HORS_LIGNE', async () => {
    const forgee = { ...REPONSE, page: { type: 'pdf', contenu: 'x' } };
    expect(await clientWorker('https://w', repondre(forgee)).lirePage(URL_PAP)).toEqual({
      ok: false,
      code: 'REPONSE_INVALIDE',
    });
    expect(
      await clientWorker('https://w', repondre({ code: 'LECTURE_INDISPONIBLE' }, 503)).lirePage(
        URL_PAP,
      ),
    ).toEqual({ ok: false, code: 'LECTURE_INDISPONIBLE' });
    expect(await clientHorsLigne.lirePage(URL_PAP)).toEqual({ ok: false, code: 'HORS_LIGNE' });
  });

  it('transmet un signal qui s’interrompt quand l’écran abandonne', async () => {
    let recu: AbortSignal | undefined;
    const fetcher: Fetch = (_, init) => {
      recu = init.signal ?? undefined;
      return Promise.resolve(new Response(JSON.stringify(REPONSE)));
    };
    const controleur = new AbortController();
    await clientWorker('https://w', fetcher).lirePage(URL_PAP, controleur.signal);
    expect(recu?.aborted).toBe(false);
    controleur.abort();
    expect(recu?.aborted).toBe(true);
  });
});

describe('signalDeRequete', () => {
  it('sans signal extérieur : le délai seul', async () => {
    const signal = signalDeRequete(5);
    expect(signal.aborted).toBe(false);
    await new Promise((resoudre) => setTimeout(resoudre, 30));
    expect(signal.aborted).toBe(true);
  });

  it('signal extérieur déjà interrompu, ou délai écoulé avant lui', async () => {
    const deja = new AbortController();
    deja.abort();
    expect(signalDeRequete(10_000, deja.signal).aborted).toBe(true);

    const signal = signalDeRequete(5, new AbortController().signal);
    await new Promise((resoudre) => setTimeout(resoudre, 30));
    expect(signal.aborted).toBe(true);
  });
});
