import { PortailSchema, capturer, type Capture, type Portail } from '@loupe/capture';
import { describe, expect, it } from 'vitest';

import { REGISTRE } from '../src/regles';

import bienici from './fixtures/bienici.html?raw';
import leboncoin from './fixtures/leboncoin.html?raw';
import logicimmo from './fixtures/logicimmo.html?raw';
import pap from './fixtures/pap.html?raw';
import seloger from './fixtures/seloger.html?raw';

/**
 * Pages enregistrées : la structure de pap.html est relevée sur une vraie annonce (13/09/2026) ;
 * les quatre autres sont construites d'après la structure connue des portails et restent
 * à vérifier sur une vraie annonce.
 */
const FIXTURES: Readonly<Record<Portail, string>> = { leboncoin, seloger, bienici, pap, logicimmo };

function fixture(portail: Portail): Document {
  return new DOMParser().parseFromString(FIXTURES[portail], 'text/html');
}

function sansScripts(document: Document): Document {
  for (const script of document.querySelectorAll('script')) script.remove();
  return document;
}

const URLS: Readonly<Record<Portail, string>> = {
  leboncoin: 'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851?utm_source=partage',
  seloger: 'https://www.seloger.com/annonces/achat/appartement/marseille-13/baille/234567890.htm',
  bienici: 'https://www.bienici.com/annonce/vente/marseille-5e/appartement/3pieces/ag13-123456',
  pap: 'https://www.pap.fr/annonces/appartement-marseille-5e-13005-r456789012',
  logicimmo: 'https://www.logic-immo.com/detail-vente-1234567.htm',
};

const MAINTENANT = new Date('2026-09-13T10:41:00.000Z');

function lire(portail: Portail, document = fixture(portail)): Capture {
  const regles = REGISTRE.reglesDuPortail(portail);
  expect(regles).toBeDefined();
  const capture = capturer(document, URLS[portail], regles!, {
    mode: 'extension',
    maintenant: MAINTENANT,
  });
  expect(capture).not.toBeNull();
  return capture!;
}

describe('registre des règles', () => {
  it('connaît les cinq portails, chacun avec une version datée', () => {
    expect(REGISTRE.versions()).toEqual({
      leboncoin: 'leboncoin-2026-09-13',
      seloger: 'seloger-2026-09-13',
      bienici: 'bienici-2026-09-13',
      pap: 'pap-2026-09-13',
      logicimmo: 'logicimmo-2026-09-13',
    });
  });
});

describe('capture par portail', () => {
  it.each(PortailSchema.options)(
    '%s : prix, surface, pièces, chambres, ville, code postal, DPE et description',
    (portail) => {
      const capture = lire(portail);
      expect(capture).toMatchObject({
        version: 1,
        portail,
        prix: 155_000,
        surface: 65,
        pieces: 3,
        chambres: 2,
        codePostal: '13005',
        dpe: 'D',
        ges: 'B',
        mode: 'extension',
        regles: `${portail}-2026-09-13`,
        captureLe: '2026-09-13T10:41:00.000Z',
      });
      expect(capture.ville).toMatch(/^Marseille/);
      expect(capture.description).toMatch(/65 m²/);
      expect(capture.description?.length).toBeLessThanOrEqual(4_000);
    },
  );

  it('leboncoin : lit l’état applicatif __NEXT_DATA__ (étage, ascenseur, charges annuelles au mois, année)', () => {
    expect(lire('leboncoin')).toMatchObject({
      id: '2214738851',
      url: 'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851',
      ville: 'Marseille',
      etage: 3,
      ascenseur: false,
      chargesCopro: 90,
      anneeConstruction: 1962,
    });
  });

  it('pap : JSON-LD Product (offre, propriétés, adresse) puis sélecteurs relevés sur le site', () => {
    expect(lire('pap')).toMatchObject({
      id: '456789012',
      ville: 'Marseille 5e',
      adresse: 'Rue de Lodi',
      description: expect.stringContaining('Quartier Baille') as string,
    });
  });

  it('seloger, bienici, logicimmo : étage et ascenseur depuis la liste des caractéristiques', () => {
    for (const portail of ['seloger', 'bienici', 'logicimmo'] as const) {
      expect(lire(portail)).toMatchObject({ etage: 3, ascenseur: false });
    }
    expect(lire('bienici').anneeConstruction).toBe(1962);
  });

  it.each(PortailSchema.options)(
    '%s : sans JSON-LD ni état applicatif, les sélecteurs CSS et les metas prennent le relais',
    (portail) => {
      const capture = lire(portail, sansScripts(fixture(portail)));
      expect(capture).toMatchObject({ prix: 155_000, surface: 65, pieces: 3, codePostal: '13005' });
      expect(capture.description).toMatch(/65 m²/);
    },
  );

  it('une maquette qui a changé donne une capture sans champs, jamais une erreur', () => {
    const page = new DOMParser().parseFromString('<p>Le site a changé.</p>', 'text/html');
    const capture = lire('seloger', page);
    expect(capture).toEqual({
      version: 1,
      portail: 'seloger',
      url: 'https://www.seloger.com/annonces/achat/appartement/marseille-13/baille/234567890.htm',
      id: '234567890',
      captureLe: '2026-09-13T10:41:00.000Z',
      mode: 'extension',
      regles: 'seloger-2026-09-13',
    });
  });

  it('les règles d’un portail ne lisent pas la page d’un autre', () => {
    const regles = REGISTRE.reglesDuPortail('pap');
    expect(capturer(fixture('pap'), URLS.leboncoin, regles!, { mode: 'extension' })).toBeNull();
  });
});
