import { describe, expect, it, vi } from 'vitest';

import {
  CaptureSchema,
  DonneesPortailSchema,
  ReglesPortailSchema,
  adresseDonnees,
  analyserJson,
  capturerAvecDonnees,
  lireSource,
  resoudreAnnonce,
  type ReglesPortail,
} from '../../src';

function page(html: string): Document {
  return new DOMParser().parseFromString(
    `<!doctype html><html><head></head><body>${html}</body></html>`,
    'text/html',
  );
}

describe('analyserJson', () => {
  it('lit du JSON pur, et l’état posé par window["X"]=JSON.parse("…")', () => {
    expect(analyserJson('{"a":1}')).toEqual({ a: 1 });
    const etat = JSON.stringify({ app: { prix: 359000, ville: 'Marseille "6e"' } });
    const script = `window["__UFRN_LIFECYCLE_SERVERREQUEST__"]=JSON.parse(${JSON.stringify(etat)});`;
    expect(analyserJson(script)).toEqual({ app: { prix: 359000, ville: 'Marseille "6e"' } });
  });

  it('rend undefined pour un script sans JSON lisible', () => {
    expect(analyserJson(null)).toBeUndefined();
    expect(analyserJson('var x = 1;')).toBeUndefined();
    expect(analyserJson('window.a=JSON.parse("{pas du json");')).toBeUndefined();
    expect(analyserJson('window.a=JSON.parse("\\u00zz");')).toBeUndefined();
    expect(analyserJson('window.a=JSON.parse("   ");')).toBeUndefined();
  });
});

describe('lireSource · json dans un script JavaScript, et source donnees', () => {
  it('prend le premier script lisible parmi ceux que désigne le sélecteur', () => {
    const etat = JSON.stringify({ c: { prix: 12 } });
    const doc = page(
      `<script>var rien = 0;</script><script>window["E"]=JSON.parse(${JSON.stringify(etat)});</script>`,
    );
    expect(
      lireSource(doc, {
        source: 'json',
        selecteur: 'script:not([src])',
        chemin: 'c.prix',
        type: 'montant',
      }),
    ).toBe(12);
  });

  it('lit les données chargées pour l’annonce, et rien sans données', () => {
    const doc = page('');
    const extracteur = {
      source: 'donnees',
      chemin: 'annualCondominiumFees',
      type: 'montant',
    } as const;
    expect(lireSource(doc, extracteur, { annualCondominiumFees: 1_200 })).toBe(1_200);
    expect(lireSource(doc, extracteur)).toBeUndefined();
  });
});

const BIENICI: ReglesPortail = ReglesPortailSchema.parse({
  version: 'bienici-2026-09-13',
  portail: 'bienici',
  donnees: { url: '/realEstateAd.json?id={id}' },
  champs: {
    prix: [{ source: 'donnees', chemin: 'price', type: 'montant' }],
    chargesCopro: [
      { source: 'donnees', chemin: 'annualCondominiumFees', type: 'montant', diviser: 12 },
    ],
    ville: [{ source: 'css', selecteur: 'h1', type: 'texte' }],
  },
});
const URL_BIENICI =
  'https://www.bienici.com/annonce/vente/troyes/appartement/3pieces/visiteonline-p_6307171';

describe('adresseDonnees', () => {
  it('remplace {id} par l’identifiant encodé ; null sans données déclarées', () => {
    const annonce = resoudreAnnonce(URL_BIENICI)!;
    expect(adresseDonnees(BIENICI, annonce)).toBe('/realEstateAd.json?id=visiteonline-p_6307171');
    expect(adresseDonnees({ ...BIENICI, donnees: undefined }, annonce)).toBeNull();
    expect(adresseDonnees(BIENICI, { ...annonce, id: 'a b&c' })).toBe(
      '/realEstateAd.json?id=a%20b%26c',
    );
  });
});

describe('capturerAvecDonnees', () => {
  const MAINTENANT = new Date('2026-09-13T10:41:00.000Z');

  it('charge les données de l’annonce puis applique les règles sur la page et les données', async () => {
    const charger = vi.fn(() => Promise.resolve({ price: 165_000, annualCondominiumFees: 1_200 }));
    const capture = await capturerAvecDonnees(page('<h1>Troyes</h1>'), URL_BIENICI, BIENICI, {
      mode: 'extension',
      maintenant: MAINTENANT,
      charger,
    });
    expect(charger).toHaveBeenCalledWith('/realEstateAd.json?id=visiteonline-p_6307171');
    expect(capture).toMatchObject({ prix: 165_000, chargesCopro: 100, ville: 'Troyes' });
    expect(CaptureSchema.safeParse(capture).success).toBe(true);
  });

  it('lit quand même la page si le chargement échoue, et ne charge rien sans données déclarées', async () => {
    const enPanne = await capturerAvecDonnees(page('<h1>Troyes</h1>'), URL_BIENICI, BIENICI, {
      mode: 'extension',
      charger: () => Promise.reject(new Error('hors ligne')),
    });
    expect(enPanne).toMatchObject({ ville: 'Troyes' });
    expect(enPanne?.prix).toBeUndefined();

    const charger = vi.fn();
    const sansDonnees = await capturerAvecDonnees(
      page('<h1>Troyes</h1>'),
      URL_BIENICI,
      { ...BIENICI, donnees: undefined },
      { mode: 'extension', charger },
    );
    expect(charger).not.toHaveBeenCalled();
    expect(sansDonnees?.ville).toBe('Troyes');
  });

  it('rend null hors annonce, sans rien charger', async () => {
    const charger = vi.fn();
    expect(
      await capturerAvecDonnees(page(''), 'https://www.bienici.com/recherche', BIENICI, {
        mode: 'extension',
        charger,
      }),
    ).toBeNull();
    expect(charger).not.toHaveBeenCalled();
  });
});

describe('DonneesPortailSchema et nouveaux champs de la capture', () => {
  it('exige une adresse relative au portail contenant {id}', () => {
    expect(DonneesPortailSchema.safeParse({ url: '/a.json?id={id}' }).success).toBe(true);
    expect(DonneesPortailSchema.safeParse({ url: 'https://autre.fr/a?id={id}' }).success).toBe(
      false,
    );
    expect(DonneesPortailSchema.safeParse({ url: '//autre.fr/a?id={id}' }).success).toBe(false);
    expect(DonneesPortailSchema.safeParse({ url: '/a.json' }).success).toBe(false);
  });

  it('accepte type de bien, lots et procédure de copropriété ; refuse les valeurs hors contrat', () => {
    const base = {
      version: 1,
      portail: 'pap',
      url: 'https://www.pap.fr/annonces/appartement-marseille-13005-r456789012',
      captureLe: '2026-09-13T10:41:00.000Z',
    };
    expect(
      CaptureSchema.parse({ ...base, typeBien: 'maison', lotsCopro: 24, coproEnProcedure: false }),
    ).toMatchObject({ typeBien: 'maison', lotsCopro: 24, coproEnProcedure: false });
    expect(CaptureSchema.safeParse({ ...base, typeBien: 'parking' }).success).toBe(false);
    expect(CaptureSchema.safeParse({ ...base, lotsCopro: 0 }).success).toBe(false);
  });
});
