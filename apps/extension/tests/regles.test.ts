import {
  PortailSchema,
  capturer,
  capturerAvecDonnees,
  type Capture,
  type Portail,
} from '@loupe/capture';
import { describe, expect, it } from 'vitest';

import { REGISTRE } from '../src/regles';

import bieniciDonnees from './fixtures/bienici.json';
import bienici from './fixtures/bienici.html?raw';
import leboncoin from './fixtures/leboncoin.html?raw';
import logicimmo from './fixtures/logicimmo.html?raw';
import pap from './fixtures/pap.html?raw';
import seloger from './fixtures/seloger.html?raw';

/**
 * Pages enregistrées : structures relevées sur de vraies annonces le 13/09/2026 (LeBonCoin,
 * SeLoger, Logic-Immo, Bien'ici dans le Chrome de l'utilisateur ; PAP dans le navigateur intégré),
 * valeurs fictives (le T3 de Marseille 5e).
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
  seloger:
    'https://www.seloger.com/annonce/achat/provence-alpes-cote-d-azur/bouches-du-rhone-13/marseille-13000/26FZC3J4KETZ',
  bienici: 'https://www.bienici.com/annonce/vente/marseille-5e/appartement/3pieces/ag13-123456',
  pap: 'https://www.pap.fr/annonces/appartement-marseille-5e-13005-r456789012',
  logicimmo:
    'https://www.logic-immo.com/detail-annonce/vente/provence-alpes-cote-d-azur/bouches-du-rhone-13/marseille-13000/262H71INQG69',
};

const MAINTENANT = new Date('2026-09-13T10:41:00.000Z');

/** Le portail sert ses données à cette adresse ; toute autre échoue, comme une page sans données. */
function chargeur(donnees: unknown = bieniciDonnees) {
  return (adresse: string): Promise<unknown> =>
    adresse === '/realEstateAd.json?id=ag13-123456'
      ? Promise.resolve(donnees)
      : Promise.reject(new Error(`404 ${adresse}`));
}

async function lire(
  portail: Portail,
  document = fixture(portail),
  charger = chargeur(),
): Promise<Capture> {
  const regles = REGISTRE.reglesDuPortail(portail);
  expect(regles).toBeDefined();
  const capture = await capturerAvecDonnees(document, URLS[portail], regles!, {
    mode: 'extension',
    maintenant: MAINTENANT,
    charger,
  });
  expect(capture).not.toBeNull();
  return capture!;
}

describe('registre des règles', () => {
  it('connaît les cinq portails, chacun avec une version datée', () => {
    expect(REGISTRE.versions()).toEqual({
      leboncoin: 'leboncoin-2026-09-14',
      seloger: 'seloger-2026-09-14',
      bienici: 'bienici-2026-09-14',
      pap: 'pap-2026-09-14',
      logicimmo: 'logicimmo-2026-09-14',
    });
  });
});

describe('capture par portail', () => {
  it.each(PortailSchema.options)(
    '%s : type, prix, surface, pièces, chambres, ville, code postal, DPE, GES et description',
    async (portail) => {
      const capture = await lire(portail);
      expect(capture).toMatchObject({
        version: 1,
        portail,
        typeBien: 'appartement',
        prix: 155_000,
        surface: 65,
        pieces: 3,
        chambres: 2,
        codePostal: '13005',
        dpe: 'D',
        ges: 'B',
        mode: 'extension',
        regles: `${portail}-2026-09-14`,
        captureLe: '2026-09-13T10:41:00.000Z',
      });
      expect(capture.ville).toMatch(/^Marseille/);
      expect(capture.description).toMatch(/65 m²/);
      expect(capture.description?.length).toBeLessThanOrEqual(4_000);
    },
  );

  it('leboncoin : __NEXT_DATA__ donne étage, ascenseur, charges annuelles ramenées au mois, taxe foncière, année', async () => {
    expect(await lire('leboncoin')).toMatchObject({
      id: '2214738851',
      url: 'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851',
      ville: 'Marseille',
      etage: 3,
      ascenseur: false,
      chargesCopro: 90,
      taxeFonciere: 1_050,
      anneeConstruction: 1962,
    });
  });

  it('seloger et logicimmo : état JSON.parse de la plateforme (étage, ascenseur, DPE avant ou après 2021)', async () => {
    for (const portail of ['seloger', 'logicimmo'] as const) {
      expect(await lire(portail)).toMatchObject({
        etage: 3,
        ascenseur: false,
        ville: 'Marseille 5ème arrondissement',
      });
    }
    expect((await lire('seloger')).id).toBe('26FZC3J4KETZ');
    expect((await lire('logicimmo')).id).toBe('262H71INQG69');
  });

  it('bienici : les données chargées par la page donnent charges, lots, procédure, année, meublé', async () => {
    expect(await lire('bienici')).toMatchObject({
      id: 'ag13-123456',
      etage: 3,
      ascenseur: false,
      chargesCopro: 90,
      lotsCopro: 24,
      coproEnProcedure: false,
      anneeConstruction: 1962,
      meuble: false,
    });
    const maison = await lire(
      'bienici',
      fixture('bienici'),
      chargeur({ ...bieniciDonnees, propertyType: 'house' }),
    );
    expect(maison.typeBien).toBe('maison');
  });

  it('pap : JSON-LD Product (offre, propriétés, adresse) puis sélecteurs relevés sur le site', async () => {
    expect(await lire('pap')).toMatchObject({
      id: '456789012',
      ville: 'Marseille 5e',
      adresse: 'Rue de Lodi',
      description: expect.stringContaining('Quartier Baille') as string,
    });
  });

  it.each(PortailSchema.options)(
    '%s : sans JSON-LD, état applicatif ni données, les sélecteurs CSS et les balises og: prennent le relais',
    async (portail) => {
      const capture = await lire(portail, sansScripts(fixture(portail)), () =>
        Promise.reject(new Error('hors ligne')),
      );
      expect(capture).toMatchObject({ prix: 155_000, surface: 65, pieces: 3, codePostal: '13005' });
      expect(capture.description).toMatch(/65 m²/);
    },
  );

  it('une maquette qui a changé donne une capture sans champs, jamais une erreur', async () => {
    const page = new DOMParser().parseFromString('<p>Le site a changé.</p>', 'text/html');
    expect(await lire('seloger', page)).toEqual({
      version: 1,
      portail: 'seloger',
      url: URLS.seloger,
      id: '26FZC3J4KETZ',
      captureLe: '2026-09-13T10:41:00.000Z',
      mode: 'extension',
      regles: 'seloger-2026-09-14',
    });
  });

  it('les règles d’un portail ne lisent pas la page d’un autre', () => {
    const regles = REGISTRE.reglesDuPortail('pap');
    expect(capturer(fixture('pap'), URLS.leboncoin, regles!, { mode: 'extension' })).toBeNull();
  });
});
