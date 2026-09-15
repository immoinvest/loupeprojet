import { captureDepuisHash } from '@loupe/capture';
import { ORIGINE_PRODUCTION_DEFAUT } from '@loupe/capture/origines';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MESSAGE_HORS_ANNONCE,
  MESSAGE_SANS_REGLES,
  REGISTRE_FAVORI,
  lancerCapture,
  type FenetrePortail,
} from '@/bookmarklet/lancer';

const URL_PAP = 'https://www.pap.fr/annonces/appartement-marseille-5e-13005-r456789012';
const BASE = ORIGINE_PRODUCTION_DEFAUT;

const PAGE_PAP = `<!doctype html><html><head>
<script type="application/ld+json">{"@type":"Product","offers":{"@type":"Offer","price":"155000"},"address":{"@type":"PostalAddress","addressLocality":"Marseille 5e","postalCode":"13005"},"additionalProperty":[{"@type":"PropertyValue","name":"Surface","value":"65.00"}]}</script>
</head><body><h1 class="item-title">Vente appartement<span class="item-price">155.000 €</span></h1></body></html>`;

function fenetre(href: string, ouvertureBloquee = false): FenetrePortail & { journal: string[] } {
  const journal: string[] = [];
  return {
    journal,
    location: {
      href,
      assign: (url) => {
        journal.push(`assign ${url}`);
      },
    },
    open: (url, cible) => {
      journal.push(`open ${cible} ${url}`);
      return ouvertureBloquee ? null : {};
    },
    alert: (message) => {
      journal.push(`alert ${message}`);
    },
  };
}

function page(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('lancerCapture', () => {
  it('lit l’annonce avec les règles de son portail et ouvre Loupe dans un nouvel onglet', () => {
    const f = fenetre(URL_PAP);
    expect(lancerCapture(page(PAGE_PAP), f, BASE)).toBe('ouverte');
    expect(f.journal).toHaveLength(1);
    const url = new URL(f.journal[0]!.replace('open _blank ', ''));
    expect(`${url.origin}${url.pathname}`).toBe(`${BASE}/projets/nouveau`);
    const lue = captureDepuisHash(url.hash);
    expect(lue).toMatchObject({
      ok: true,
      capture: {
        portail: 'pap',
        id: '456789012',
        prix: 155_000,
        surface: 65,
        ville: 'Marseille 5e',
        codePostal: '13005',
        mode: 'bookmarklet',
        regles: 'pap-2026-09-14',
      },
    });
  });

  it('navigue dans la page courante si l’ouverture d’un onglet est bloquée', () => {
    const f = fenetre(URL_PAP, true);
    expect(lancerCapture(page(PAGE_PAP), f, BASE)).toBe('ouverte');
    expect(f.journal[0]).toMatch(/^open _blank /);
    expect(f.journal[1]).toMatch(
      /^assign https:\/\/loupeprojet\.pages\.dev\/projets\/nouveau#capture=/,
    );
  });

  it('explique quoi faire hors d’une annonce, ou si le portail n’a pas de règles', () => {
    const ailleurs = fenetre('https://www.pap.fr/annonce/vente-appartement-marseille-13');
    expect(lancerCapture(page(PAGE_PAP), ailleurs, BASE)).toBe('hors-annonce');
    expect(ailleurs.journal).toEqual([`alert ${MESSAGE_HORS_ANNONCE}`]);

    const sansRegles = fenetre(URL_PAP);
    expect(
      lancerCapture(page(PAGE_PAP), sansRegles, BASE, {
        reglesDuPortail: () => undefined,
        versions: () => ({}),
      }),
    ).toBe('sans-regles');
    expect(sansRegles.journal).toEqual([`alert ${MESSAGE_SANS_REGLES}`]);

    const reglesLbc = REGISTRE_FAVORI.reglesDuPortail('leboncoin');
    const tordue = fenetre(URL_PAP);
    expect(
      lancerCapture(page(PAGE_PAP), tordue, BASE, {
        reglesDuPortail: () => reglesLbc,
        versions: () => ({}),
      }),
    ).toBe('sans-regles');
  });

  it('embarque les règles des cinq portails', () => {
    expect(Object.keys(REGISTRE_FAVORI.versions()).sort()).toEqual([
      'bienici',
      'leboncoin',
      'logicimmo',
      'pap',
      'seloger',
    ]);
  });
});

describe('point d’entrée du favori', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('lance la capture sur la fenêtre courante avec l’adresse figée au build', async () => {
    const alerte = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    await import('@/bookmarklet/capture');
    // jsdom n'est pas sur une annonce : le favori le dit, sans rien ouvrir.
    expect(alerte).toHaveBeenCalledWith(MESSAGE_HORS_ANNONCE);
  });
});
