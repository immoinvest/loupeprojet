import { describe, expect, it } from 'vitest';

import { construireProjet, type SaisieProjet } from '@/annonces';
import {
  clientHorsLigne,
  clientWorker,
  enrichirSaisie,
  fusionnerChamps,
  lireAnnonce,
  marcheDepuisReponse,
  URL_WORKER_DEFAUT,
  urlWorker,
  type ChampsIa,
  type ClientWorker,
  type Fetch,
  type ReponseMarche,
  type Resultat,
} from '@/enrichissement';

const TEXTE = `Appartement T3 de 65 m² à Marseille 5e (13005), quartier Baille.
Au 3e étage sans ascenseur d'un immeuble construit en 1962. Prix : 155 000 €.`;

const CHAMPS_IA: ChampsIa = {
  prix: 155000,
  surface: 65,
  pieces: 3,
  chambres: 2,
  etage: 3,
  ascenseur: false,
  dpe: 'D',
  codePostal: '13005',
  ville: 'Marseille',
  annee: 1962,
  chargesCoproMois: 150,
  taxeFonciere: null,
  honorairesAgence: null,
  meuble: null,
};

const MARCHE: ReponseMarche = {
  codeInsee: '13205',
  commune: 'Marseille 5e Arrondissement',
  dvf: { ventes: 1823, medianeM2: 3423, q1M2: 2833, q3M2: 4135 },
  loyer: { loyerM2: 15.03, basM2: 11.83, hautM2: 19.09, observations: 4655 },
  zone: 'A',
  sources: [{ nom: 'DVF', url: 'https://www.data.gouv.fr/dvf', licence: 'Licence Ouverte 2.0' }],
};

function json(corps: unknown, status = 200): Response {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Un faux fetch qui note les appels et rend la réponse fournie. */
function fauxFetch(reponse: () => Promise<Response>): Fetch & {
  appels: { url: string; init: RequestInit }[];
} {
  const appels: { url: string; init: RequestInit }[] = [];
  const f = (url: string, init: RequestInit): Promise<Response> => {
    appels.push({ url, init });
    return reponse();
  };
  return Object.assign(f, { appels });
}

function clientFixe(surcharges: Partial<ClientWorker>): ClientWorker {
  return { ...clientHorsLigne, ...surcharges };
}

const ok = <T>(valeur: T): Promise<Resultat<T>> => Promise.resolve({ ok: true, valeur });

describe('adresse du Worker', () => {
  it('prend VITE_WORKER_URL si c’est une adresse http(s), la production sinon', () => {
    expect(urlWorker(undefined)).toBe(URL_WORKER_DEFAUT);
    expect(urlWorker('')).toBe(URL_WORKER_DEFAUT);
    expect(urlWorker('ftp://ailleurs')).toBe(URL_WORKER_DEFAUT);
    expect(urlWorker('http://localhost:8787/')).toBe('http://localhost:8787');
  });
});

describe('client du Worker', () => {
  const base = 'https://worker.test';

  it('extraire : POST JSON, rend les champs validés', async () => {
    const f = fauxFetch(() =>
      Promise.resolve(json({ champs: { ...CHAMPS_IA, ges: 'E' }, modele: 'm' })),
    );
    const r = await clientWorker(base, f).extraire(TEXTE);
    expect(r).toEqual({ ok: true, valeur: CHAMPS_IA });
    expect(f.appels[0]?.url).toBe('https://worker.test/extract');
    expect(f.appels[0]?.init.method).toBe('POST');
    expect(JSON.parse(f.appels[0]?.init.body as string)).toEqual({ texte: TEXTE });
    expect(f.appels[0]?.init.signal).toBeInstanceOf(AbortSignal);
  });

  it('traduit les échecs en codes', async () => {
    const cas: [() => Promise<Response>, string][] = [
      [() => Promise.reject(new TypeError('Failed to fetch')), 'RESEAU'],
      [() => Promise.resolve(new Response('<html>')), 'REPONSE_INVALIDE'],
      [
        () => Promise.resolve(json({ code: 'EXTRACTION_INDISPONIBLE' }, 503)),
        'EXTRACTION_INDISPONIBLE',
      ],
      [() => Promise.resolve(json({ message: 'oups' }, 500)), 'HTTP_500'],
      [() => Promise.resolve(json({ champs: { prix: 'cher' }, modele: 'm' })), 'REPONSE_INVALIDE'],
    ];
    for (const [reponse, code] of cas) {
      expect(await clientWorker(base, fauxFetch(reponse)).extraire(TEXTE)).toEqual({
        ok: false,
        code,
      });
    }
  });

  it('geocoder : premier résultat, null sans résultat, échec transmis', async () => {
    const resultat = {
      libelle: 'Marseille 5e Arrondissement',
      lat: 43.29,
      lon: 5.4,
      precision: 'commune',
      codeInsee: '13205',
      codePostal: '13005',
    };
    const f = fauxFetch(() => Promise.resolve(json({ donnees: { resultats: [resultat] } })));
    expect(await clientWorker(base, f).geocoder('13005 Marseille', '13005')).toEqual({
      ok: true,
      valeur: resultat,
    });
    expect(f.appels[0]?.url).toBe(
      'https://worker.test/proxy/geocodage?q=13005+Marseille&limit=1&codePostal=13005',
    );
    const vide = fauxFetch(() => Promise.resolve(json({ donnees: { resultats: [] } })));
    expect(await clientWorker(base, vide).geocoder('x', '13005')).toEqual({
      ok: true,
      valeur: null,
    });
    const echec = fauxFetch(() => Promise.resolve(json({ code: 'AMONT_SATURE' }, 503)));
    expect(await clientWorker(base, echec).geocoder('x', '13005')).toEqual({
      ok: false,
      code: 'AMONT_SATURE',
    });
  });

  it('marche : paramètres dans l’adresse, pièces seulement si connues', async () => {
    const f = fauxFetch(() => Promise.resolve(json({ ...MARCHE, departement: '13' })));
    const client = clientWorker(base, f);
    expect(
      await client.marche({
        codeInsee: '13205',
        codePostal: '13005',
        type: 'appartement',
        pieces: 3,
      }),
    ).toEqual({ ok: true, valeur: MARCHE });
    await client.marche({ codeInsee: '13205', codePostal: '13005', type: 'appartement' });
    expect(f.appels.map((a) => a.url)).toEqual([
      'https://worker.test/marche?codeInsee=13205&codePostal=13005&type=appartement&pieces=3',
      'https://worker.test/marche?codeInsee=13205&codePostal=13005&type=appartement',
    ]);
  });

  it('hors ligne : tout échoue avec HORS_LIGNE, sans réseau', async () => {
    expect(await clientHorsLigne.extraire(TEXTE)).toEqual({ ok: false, code: 'HORS_LIGNE' });
    expect(await clientHorsLigne.geocoder('x', '13005')).toEqual({ ok: false, code: 'HORS_LIGNE' });
    expect(
      await clientHorsLigne.marche({
        codeInsee: '13205',
        codePostal: '13005',
        type: 'appartement',
      }),
    ).toEqual({ ok: false, code: 'HORS_LIGNE' });
  });
});

describe('lecture de l’annonce', () => {
  it('l’IA prime, les règles comblent ce qu’elle n’a pas trouvé', () => {
    const fusion = fusionnerChamps(
      { ville: 'Marseille 5e', taxeFonciere: 1050, prix: 1 },
      CHAMPS_IA,
    );
    expect(fusion).toMatchObject({
      prix: 155000,
      ville: 'Marseille',
      taxeFonciere: 1050,
      ascenseur: false,
    });
    expect(fusion).not.toHaveProperty('meuble');
  });

  it('lecture par l’IA quand le Worker répond, par règles sinon ou pour un texte trop court', async () => {
    const appels: string[] = [];
    const client = clientFixe({
      extraire: (texte) => {
        appels.push(texte);
        return ok(CHAMPS_IA);
      },
    });
    expect(await lireAnnonce(TEXTE, client)).toMatchObject({
      mode: 'ia',
      champs: { prix: 155000, ville: 'Marseille', chargesCoproMois: 150 },
    });
    const regles = await lireAnnonce(TEXTE, clientHorsLigne);
    expect(regles).toMatchObject({
      mode: 'regles',
      champs: { prix: 155000, ville: 'Marseille 5e' },
    });
    expect(await lireAnnonce('Prix 155 000 €', client)).toEqual({
      mode: 'regles',
      champs: { prix: 155000 },
    });
    expect(appels).toEqual([TEXTE]);
  });
});

describe('données de marché', () => {
  it('convertit la réponse au format du moteur, loyer ramené hors charges', () => {
    expect(marcheDepuisReponse(MARCHE)).toEqual({
      codeInsee: '13205',
      marche: {
        dvf: { medianM2: 3423, q1M2: 2833, q3M2: 4135, nombreVentes: 1823 },
        loyerReferenceM2: 13.83,
      },
      provenance: {
        'marche.dvf.medianM2': 'dvf',
        'marche.dvf.q1M2': 'dvf',
        'marche.dvf.q3M2': 'dvf',
        'marche.dvf.nombreVentes': 'dvf',
        'marche.loyerReferenceM2': 'anil',
      },
    });
    expect(marcheDepuisReponse({ ...MARCHE, dvf: null, loyer: null })).toEqual({
      codeInsee: '13205',
      marche: {},
      provenance: {},
    });
  });

  const saisie: SaisieProjet = {
    prix: 155000,
    surface: 65,
    pieces: 3,
    codePostal: '13005',
    ville: 'Marseille 5e',
    mode: 'meuble_lld',
    loyerHc: 980,
    apport: 15000,
    dureeAnnees: 25,
    tmi: 0.3,
    provenance: { prix: 'annonce' },
  };

  it('enrichit la saisie : géocodage puis marché de la commune', async () => {
    const demandes: unknown[] = [];
    const client = clientFixe({
      geocoder: (recherche, codePostal) => {
        demandes.push({ recherche, codePostal });
        return ok({
          libelle: 'Marseille 5e Arrondissement',
          lat: 43.29,
          lon: 5.4,
          precision: 'commune',
          codeInsee: '13205',
          codePostal: '13005',
        });
      },
      marche: (p) => {
        demandes.push(p);
        return ok(MARCHE);
      },
    });
    const enrichi = await enrichirSaisie(saisie, client);
    expect(enrichi?.marche.dvf?.medianM2).toBe(3423);
    expect(demandes).toEqual([
      { recherche: '13005 Marseille 5e', codePostal: '13005' },
      { codeInsee: '13205', codePostal: '13005', type: 'appartement', pieces: 3 },
    ]);

    const projet = construireProjet(saisie, 'p1', enrichi);
    expect(projet.marche?.dvf).toEqual({
      medianM2: 3423,
      q1M2: 2833,
      q3M2: 4135,
      nombreVentes: 1823,
    });
    expect(projet.provenance?.['marche.dvf.medianM2']).toBe('dvf');
    expect(projet.provenance?.['achat.prix']).toBe('annonce');
    expect(construireProjet(saisie, 'p2').marche).toBeUndefined();
  });

  it('rend null dès qu’une étape échoue', async () => {
    const lieu = {
      libelle: 'Marseille',
      lat: 43.28,
      lon: 5.4,
      precision: 'commune',
      codeInsee: '13055',
      codePostal: '13001',
    };
    const cas: ClientWorker[] = [
      clientHorsLigne,
      clientFixe({ geocoder: () => ok(null) }),
      clientFixe({ geocoder: () => ok({ ...lieu, codeInsee: null }) }),
      clientFixe({ geocoder: () => ok(lieu) }),
    ];
    for (const client of cas) {
      expect(await enrichirSaisie(saisie, client)).toBeNull();
    }
  });
});
