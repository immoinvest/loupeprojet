import { capturerAvecDonnees, type Capture, type Portail } from '@loupe/capture';
import { describe, expect, it } from 'vitest';

import { REGISTRE } from '../src/regles';

import bieniciDonnees from './fixtures/bienici-complet.json';
import leboncoin from './fixtures/leboncoin-complet.html?raw';
import logicimmo from './fixtures/logicimmo-complet.html?raw';
import pap from './fixtures/pap-complet.html?raw';
import seloger from './fixtures/seloger-complet.html?raw';

/**
 * Pages réelles du 14/09/2026, lues par Bright Data puis réduites : caractéristiques telles que les
 * portails les publient, textes, photos et vendeur remplacés (script `fixtures.cjs` de la session).
 */
const URLS: Readonly<Record<Portail, string>> = {
  leboncoin: 'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851',
  seloger:
    'https://www.seloger.com/annonce/achat/provence-alpes-cote-d-azur/alpes-maritimes-06/nice-06000/26H8ZWTFJ25E',
  logicimmo:
    'https://www.logic-immo.com/detail-annonce/vente/ile-de-france/paris-75/paris-75000/26H77PARXRYA',
  pap: 'https://www.pap.fr/annonces/appartement-nice-06000-r463902045',
  bienici: 'https://www.bienici.com/annonce/vente/troyes/appartement/3pieces/ag13-654321',
};

const PAGES: Readonly<Record<Portail, string>> = {
  leboncoin,
  seloger,
  logicimmo,
  pap,
  // Bien'ici n'écrit rien dans le HTML : tout vient de /realEstateAd.json.
  bienici: '<!doctype html><html><head></head><body></body></html>',
};

async function lire(portail: Portail): Promise<Capture> {
  const document = new DOMParser().parseFromString(PAGES[portail], 'text/html');
  const capture = await capturerAvecDonnees(
    document,
    URLS[portail],
    REGISTRE.reglesDuPortail(portail)!,
    {
      mode: 'serveur',
      maintenant: new Date('2026-09-14T12:00:00.000Z'),
      charger: (adresse) =>
        adresse === '/realEstateAd.json?id=ag13-654321'
          ? Promise.resolve(bieniciDonnees)
          : Promise.reject(new Error(adresse)),
    },
  );
  expect(capture).not.toBeNull();
  return capture!;
}

const photos = (prefixe: string): string[] =>
  [1, 2, 3].map((n) => `https://img.exemple.fr/${prefixe}-${String(n)}.jpg`);

describe('règles enrichies sur les pages réelles', () => {
  it('leboncoin : chauffage, état, immeuble, extérieur, équipements, énergie, honoraires, vendeur, photos', async () => {
    const capture = await lire('leboncoin');
    expect(capture).toMatchObject({
      regles: 'leboncoin-2026-09-14',
      mode: 'serveur',
      typeBien: 'appartement',
      prix: 144_900,
      surface: 67,
      pieces: 4,
      chambres: 3,
      ville: 'Toulon',
      codePostal: '83000',
      quartier: 'Saint-Roch',
      etage: 0,
      etagesImmeuble: 7,
      ascenseur: true,
      dpe: 'E',
      ges: 'E',
      anneeConstruction: 1966,
      chauffageCollectif: true,
      chauffageEnergie: 'electricite',
      etat: 'bon_etat',
      balcon: true,
      cave: true,
      interphone: true,
      sallesEau: 1,
      honorairesACharge: 'vendeur',
      budgetEnergieMin: 941,
      budgetEnergieMax: 1_273,
      vendeur: 'pro',
      publieeLe: '2026-08-28',
      photos: photos('lbc'),
    });
    expect(capture.chargesCopro).toBeCloseTo(2_300 / 12);
    // Ce que l'annonce ne dit pas reste absent, jamais « non » par défaut.
    for (const absent of ['parking', 'digicode', 'terrasse', 'jardin', 'honoraires'] as const) {
      expect(capture[absent]).toBeUndefined();
    }
  });

  it('seloger : caractéristiques par catégorie, énergie du DPE, honoraires à la charge du vendeur', async () => {
    const capture = await lire('seloger');
    expect(capture).toMatchObject({
      regles: 'seloger-2026-09-14',
      typeBien: 'appartement',
      prix: 472_000,
      surface: 76.22,
      pieces: 4,
      chambres: 3,
      ville: 'Nice',
      codePostal: '06000',
      quartier: 'Vernier',
      etage: 5,
      etagesImmeuble: 6,
      ascenseur: true,
      anneeConstruction: 2017,
      etat: 'renove',
      chauffageCollectif: false,
      chauffageEnergie: 'electricite',
      dpe: 'A',
      ges: 'A',
      consommationEnergie: 42,
      budgetEnergieMin: 410,
      budgetEnergieMax: 560,
      meuble: false,
      balcon: true,
      parking: true,
      accessiblePmr: true,
      interphone: true,
      digicode: true,
      sallesEau: 1,
      honorairesACharge: 'vendeur',
      vendeur: 'pro',
      publieeLe: '2026-09-13',
      photos: photos('sl'),
    });
    expect(capture.jardin).toBeUndefined();
    expect(capture.honoraires).toBeUndefined();
  });

  it('logicimmo : « Pas de balcon » vaut non, honoraires chiffrés à la charge de l’acquéreur', async () => {
    const capture = await lire('logicimmo');
    expect(capture).toMatchObject({
      regles: 'logicimmo-2026-09-14',
      prix: 149_500,
      surface: 14,
      pieces: 1,
      ville: 'Paris 13ème arrondissement',
      codePostal: '75013',
      quartier: 'Bièvres Sud Tolbiac',
      etage: 0,
      etagesImmeuble: 1,
      ascenseur: true,
      etat: 'renove',
      chauffageEnergie: 'gaz',
      meuble: true,
      balcon: false,
      jardin: true,
      digicode: true,
      accessiblePmr: false,
      honoraires: 6_000,
      honorairesACharge: 'acquereur',
      vendeur: 'pro',
      publieeLe: '2026-06-29',
      photos: photos('li'),
    });
    // « Chauffage central » ne dit ni collectif ni individuel.
    expect(capture.chauffageCollectif).toBeUndefined();
    expect(capture.dpe).toBeUndefined();
  });

  it('pap : photos, ascenseur, balcon ou terrasse et vendeur particulier depuis le JSON-LD', async () => {
    expect(await lire('pap')).toMatchObject({
      regles: 'pap-2026-09-14',
      typeBien: 'appartement',
      prix: 249_000,
      surface: 47,
      pieces: 1,
      ville: 'Nice',
      codePostal: '06000',
      ascenseur: true,
      balcon: true,
      vendeur: 'particulier',
      photos: photos('pap'),
    });
  });

  it('bienici : données de l’annonce (chauffage en texte, équipements, énergie, copropriété, photos)', async () => {
    const capture = await lire('bienici');
    expect(capture).toMatchObject({
      regles: 'bienici-2026-09-14',
      id: 'ag13-654321',
      surface: 72.42,
      pieces: 3,
      chambres: 2,
      etage: 3,
      etagesImmeuble: 4,
      ascenseur: false,
      anneeConstruction: 1950,
      dpe: 'E',
      ges: 'D',
      consommationEnergie: 282,
      dateDpe: '2022-07-08',
      budgetEnergieMin: 1_238,
      budgetEnergieMax: 1_674,
      chauffageCollectif: true,
      chauffageEnergie: 'gaz',
      lotsCopro: 86,
      coproEnProcedure: false,
      balcon: true,
      terrasse: false,
      cave: false,
      parking: true,
      gardien: false,
      piscine: false,
      climatisation: false,
      cheminee: false,
      accessiblePmr: false,
      sallesEau: 1,
      quartier: 'Charmilles',
      vendeur: 'pro',
      photos: photos('bienici'),
    });
    // « workToDo: false » ne dit pas l'état ; « feesChargedTo: both » ne désigne personne.
    expect(capture.etat).toBeUndefined();
    expect(capture.honorairesACharge).toBeUndefined();
  });
});
