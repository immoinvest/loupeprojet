import { creerRegistre } from '@loupe/capture';
import { describe, expect, it, vi } from 'vitest';

import { ResultatLectureSchema, chargeurDuPortail, lirePage } from '../src/logique/lire-page';
import { REGISTRE } from '../src/regles';

import bieniciDonnees from './fixtures/bienici.json';
import bienici from './fixtures/bienici.html?raw';
import leboncoin from './fixtures/leboncoin.html?raw';

const URL_LBC = 'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851';
const URL_BIENICI =
  'https://www.bienici.com/annonce/vente/marseille-5e/appartement/3pieces/ag13-123456';

function page(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

const aucunesDonnees = (): Promise<unknown> => Promise.reject(new Error('aucune'));

describe('lirePage', () => {
  it('rend la capture de la page avec les règles de son portail', async () => {
    const resultat = await lirePage(page(leboncoin), URL_LBC, REGISTRE, aucunesDonnees);
    expect(resultat.ok).toBe(true);
    if (!resultat.ok) return;
    expect(resultat.capture).toMatchObject({ portail: 'leboncoin', prix: 155_000, surface: 65 });
    expect(ResultatLectureSchema.safeParse(resultat).success).toBe(true);
  });

  it('charge les données de l’annonce quand le portail en déclare (Bien’ici)', async () => {
    const charger = vi.fn(() => Promise.resolve(bieniciDonnees));
    const resultat = await lirePage(page(bienici), URL_BIENICI, REGISTRE, charger);
    expect(charger).toHaveBeenCalledWith('/realEstateAd.json?id=ag13-123456');
    expect(resultat).toMatchObject({ ok: true, capture: { prix: 155_000, lotsCopro: 24 } });
  });

  it('explique pourquoi il n’y a pas de capture : hors annonce, portail sans règles', async () => {
    expect(
      await lirePage(
        page(leboncoin),
        'https://www.leboncoin.fr/recherche',
        REGISTRE,
        aucunesDonnees,
      ),
    ).toEqual({ ok: false, raison: 'hors-annonce' });
    expect(await lirePage(page(leboncoin), URL_LBC, creerRegistre([]), aucunesDonnees)).toEqual({
      ok: false,
      raison: 'portail-sans-regles',
    });
  });

  it('traite comme hors annonce des règles qui ne correspondent pas au portail de l’URL', async () => {
    const reglesPap = REGISTRE.reglesDuPortail('pap');
    const registreTordu = { reglesDuPortail: () => reglesPap, versions: () => ({}) };
    expect(await lirePage(page(leboncoin), URL_LBC, registreTordu, aucunesDonnees)).toEqual({
      ok: false,
      raison: 'hors-annonce',
    });
  });
});

describe('chargeurDuPortail', () => {
  const ORIGINE = 'https://www.bienici.com';

  it('charge une adresse relative sur le portail, avec les cookies du visiteur', async () => {
    const recuperer = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ price: 1 }),
      } as Response),
    );
    expect(await chargeurDuPortail(recuperer, ORIGINE)('/realEstateAd.json?id=x')).toEqual({
      price: 1,
    });
    expect(recuperer).toHaveBeenCalledWith('https://www.bienici.com/realEstateAd.json?id=x', {
      credentials: 'include',
      headers: { accept: 'application/json' },
    });
  });

  it('refuse une adresse hors du portail et signale une réponse en erreur', async () => {
    const recuperer = vi.fn(() =>
      Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response),
    );
    const charger = chargeurDuPortail(recuperer, ORIGINE);
    await expect(charger('//autre.fr/vol.json')).rejects.toThrow(/hors du portail/);
    expect(recuperer).not.toHaveBeenCalled();
    await expect(charger('/realEstateAd.json?id=x')).rejects.toThrow(/HTTP 404/);
  });
});
