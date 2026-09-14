import { creerRegistre } from '@loupe/capture';
import { describe, expect, it, vi } from 'vitest';

import { lireParServeur, raisonDuCode, type RaisonEchecServeur } from '@/annonces/lecture-serveur';
import { clientHorsLigne, type ClientWorker, type Resultat } from '@/enrichissement';
import type { PageLue } from '@/enrichissement/contrat';
import { NOMS_PORTAILS, texteEchecServeur } from '@/textes/lecture-serveur';

const URL_PAP = 'https://www.pap.fr/annonces/appartement-nice-06000-r463902045';
const URL_BIENICI = 'https://www.bienici.com/annonce/vente/troyes/appartement/3pieces/ag13-654321';
const MAINTENANT = new Date('2026-09-14T12:00:00.000Z');

/** Page PAP réduite : le JSON-LD Product que les règles lisent. */
const PAGE_PAP = `<html><head><script type="application/ld+json">${JSON.stringify({
  '@type': 'Product',
  description: 'Studio T1 de 47 m² à Nice.',
  image: ['https://img.exemple.fr/pap-1.jpg'],
  offers: { '@type': 'Offer', price: '249000', seller: { name: 'Particulier' } },
  additionalProperty: [
    { name: 'Surface', value: '47.00' },
    { name: 'Nombre de pièces', value: 1 },
    { name: 'Ascenseur', value: 'Oui' },
  ],
  address: { addressLocality: 'Nice', postalCode: '06000' },
})}</script></head><body></body></html>`;

function page(valeur: Partial<PageLue> & Pick<PageLue, 'page'>): Resultat<PageLue> {
  return {
    ok: true,
    valeur: {
      portail: 'pap',
      url: URL_PAP,
      tentatives: 1,
      obtenuLe: MAINTENANT.toISOString(),
      ...valeur,
    },
  };
}

function client(reponse: Resultat<PageLue>): ClientWorker {
  return { ...clientHorsLigne, lirePage: () => Promise.resolve(reponse) };
}

describe('lireParServeur', () => {
  it('applique les règles du portail à la page rapportée par le Worker, en mode serveur', async () => {
    const lirePage = vi.fn<ClientWorker['lirePage']>(() =>
      Promise.resolve(page({ page: { type: 'html', html: PAGE_PAP } })),
    );
    const signal = new AbortController().signal;
    const lu = await lireParServeur(
      URL_PAP,
      { ...clientHorsLigne, lirePage },
      { signal, maintenant: () => MAINTENANT },
    );
    expect(lirePage).toHaveBeenCalledWith(URL_PAP, signal);
    expect(lu).toMatchObject({
      ok: true,
      capture: {
        portail: 'pap',
        mode: 'serveur',
        prix: 249_000,
        surface: 47,
        ascenseur: true,
        vendeur: 'particulier',
        photos: ['https://img.exemple.fr/pap-1.jpg'],
        captureLe: MAINTENANT.toISOString(),
        regles: 'pap-2026-09-14',
      },
    });
  });

  it('Bien’ici : les données rapportées remplacent le chargement sur le portail ; document vide', async () => {
    const analyser = vi.fn((html: string) => new DOMParser().parseFromString(html, 'text/html'));
    const donnees = { price: 155_000, surfaceArea: 65, propertyType: 'flat', photos: [] };
    const c = client(
      page({ portail: 'bienici', url: URL_BIENICI, page: { type: 'donnees', donnees } }),
    );
    const lu = await lireParServeur(URL_BIENICI, c, { analyser });
    expect(analyser).toHaveBeenCalledWith('');
    expect(lu).toMatchObject({
      ok: true,
      capture: { prix: 155_000, surface: 65, typeBien: 'appartement' },
    });
  });

  it.each<[string, Resultat<PageLue>]>([
    ['une page sans données', page({ page: { type: 'html', html: '<html>Vérification…</html>' } })],
    [
      'Bien’ici sans ses données',
      page({ portail: 'bienici', url: URL_BIENICI, page: { type: 'html', html: '<html></html>' } }),
    ],
    [
      'une page d’un autre portail que l’URL rapportée',
      page({ portail: 'leboncoin', page: { type: 'html', html: PAGE_PAP } }),
    ],
  ])('%s : vide', async (_, reponse) => {
    expect(await lireParServeur(URL_PAP, client(reponse))).toEqual({ ok: false, raison: 'vide' });
  });

  it('portail sans règles : bloquée', async () => {
    const c = client(page({ page: { type: 'html', html: PAGE_PAP } }));
    expect(await lireParServeur(URL_PAP, c, { registre: creerRegistre([]) })).toEqual({
      ok: false,
      raison: 'bloquee',
    });
  });

  it('échec du Worker : la raison vient du code', async () => {
    const c = client({ ok: false, code: 'ANNONCE_INTROUVABLE' });
    expect(await lireParServeur(URL_PAP, c)).toEqual({ ok: false, raison: 'introuvable' });
  });

  it('annulée par la personne : annulée, quoi que le Worker ait rendu', async () => {
    const controleur = new AbortController();
    controleur.abort();
    const c = client({ ok: false, code: 'RESEAU' });
    expect(await lireParServeur(URL_PAP, c, { signal: controleur.signal })).toEqual({
      ok: false,
      raison: 'annulee',
    });
  });
});

describe('raisonDuCode', () => {
  it.each<[string, RaisonEchecServeur]>([
    ['LECTURE_INDISPONIBLE', 'indisponible'],
    ['HORS_LIGNE', 'indisponible'],
    ['INTROUVABLE', 'indisponible'],
    ['HTTP_404', 'indisponible'],
    ['ANNONCE_INTROUVABLE', 'introuvable'],
    ['TROP_DE_REQUETES', 'limite'],
    ['RESEAU', 'reseau'],
    ['AMONT_VIDE', 'bloquee'],
    ['AMONT_INDISPONIBLE', 'bloquee'],
    ['REPONSE_INVALIDE', 'bloquee'],
  ])('%s → %s', (code, raison) => {
    expect(raisonDuCode(code)).toBe(raison);
  });
});

describe('textes de la lecture serveur', () => {
  it('une phrase distincte par raison, et le nom de chaque portail', () => {
    const raisons: RaisonEchecServeur[] = [
      'indisponible',
      'introuvable',
      'bloquee',
      'limite',
      'reseau',
      'vide',
      'annulee',
    ];
    const textes = raisons.map(texteEchecServeur);
    expect(new Set(textes).size).toBe(raisons.length);
    for (const texte of textes) expect(texte.length).toBeGreaterThan(20);
    expect(NOMS_PORTAILS).toEqual({
      leboncoin: 'LeBonCoin',
      seloger: 'SeLoger',
      bienici: "Bien'ici",
      pap: 'PAP',
      logicimmo: 'Logic-Immo',
    });
  });
});
