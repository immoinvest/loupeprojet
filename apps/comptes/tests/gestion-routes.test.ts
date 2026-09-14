import type { CreationLocation, CreationReponse, EtatGestion, Paiement } from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import type { DepotGestion } from '../src/gestion/depot';
import { TAILLE_MAX_OCTETS } from '../src/gestion/routes';
import { bancD1, compter, connecter, type Banc } from './aide';

const CAMILLE = 'camille@example.org';

const CREATION: CreationLocation = {
  bien: {
    nom: 'T2 Lices',
    adresse: '12 rue des Lices',
    codePostal: '13005',
    ville: 'Marseille',
    type: 'appartement',
    surface: 38,
    meuble: true,
    projetId: 'projet-lices',
    projet: { id: 'projet-lices', versionRegles: '2026-09' },
  },
  locataire: { prenom: 'Julie', nom: 'Martin', email: 'julie.martin@exemple.fr' },
  location: {
    type: 'meublee',
    debut: '2026-10-01',
    jourLoyer: 5,
    loyerHorsCharges: 65_000,
    charges: 5_000,
    depot: 130_000,
  },
};

const VACANT: CreationLocation = {
  bien: { nom: 'Parking Prado', adresse: '8 avenue du Prado', type: 'parking', meuble: false },
  locataire: null,
  location: null,
};

async function lire<T>(reponse: Response): Promise<T> {
  return (await reponse.json()) as T;
}

async function etat(b: Banc): Promise<EtatGestion> {
  const r = await b.requete('/api/gestion/etat');
  expect(r.status).toBe(200);
  return lire<EtatGestion>(r);
}

async function creerLouee(b: Banc): Promise<CreationReponse> {
  const r = await b.requete('/api/gestion/locations', { corps: CREATION });
  expect(r.status).toBe(201);
  return lire<CreationReponse>(r);
}

function paiementDe(locationId: string): object {
  return { locationId, periode: '2026-10', montant: 70_000, date: '2026-10-05' };
}

describe('accès aux routes de gestion', () => {
  it('sans session : 401 NON_CONNECTE sur chaque route', async () => {
    const b = bancD1();
    const appels = [
      ['/api/gestion/etat', {}],
      ['/api/gestion/locations', { corps: CREATION }],
      ['/api/gestion/paiements', { corps: paiementDe('l1') }],
      ['/api/gestion/paiements/p1', { method: 'DELETE' }],
      ['/api/gestion/preferences', { method: 'PUT', corps: { analyser: true, gerer: true } }],
    ] as const;
    for (const [chemin, options] of appels) {
      const r = await b.requete(chemin, options);
      expect(r.status, chemin).toBe(401);
      expect(await r.json()).toEqual({ code: 'NON_CONNECTE' });
    }
  });

  it('une écriture sans en-tête Origin ou d’une origine inconnue : 403, rien n’est écrit', async () => {
    const b = bancD1();
    await connecter(b, CAMILLE);
    for (const origine of [null, 'https://deklic.pirate.example']) {
      const r = await b.requete('/api/gestion/locations', { corps: CREATION, origine });
      expect(r.status).toBe(403);
      expect(await r.json()).toEqual({ code: 'ORIGINE_INCONNUE' });
    }
    expect(compter(b.sqlite, 'gestion_bien')).toBe(0);
    // Une lecture n'exige pas l'en-tête Origin (navigation, service worker).
    expect((await b.requete('/api/gestion/etat', { origine: null })).status).toBe(200);
  });

  it('un hôte inconnu est refusé même en lecture', async () => {
    const b = bancD1({ origine: 'https://deklic.pirate.example' });
    const r = await b.requete('/api/gestion/etat');
    expect(r.status).toBe(403);
  });
});

describe('état et création', () => {
  it('au départ : aucune donnée, les deux sections du menu, jamais en cache', async () => {
    const b = bancD1();
    await connecter(b, CAMILLE);
    const r = await b.requete('/api/gestion/etat');
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.json()).toEqual({
      biens: [],
      locataires: [],
      locations: [],
      paiements: [],
      preferences: { analyser: true, gerer: true },
    });
  });

  it('crée un bien loué en une requête, puis un bien vacant ; l’état les rend', async () => {
    const b = bancD1();
    await connecter(b, CAMILLE);
    const cree = await creerLouee(b);
    expect(cree.bien).toMatchObject({ nom: 'T2 Lices', projet: CREATION.bien.projet });
    expect(cree.location).toMatchObject({
      bienId: cree.bien.id,
      locataireId: cree.locataire?.id,
      loyerHorsCharges: 65_000,
    });
    const vacant = await b.requete('/api/gestion/locations', { corps: VACANT });
    expect(vacant.status).toBe(201);
    expect(await lire<CreationReponse>(vacant)).toMatchObject({ locataire: null, location: null });

    const lu = await etat(b);
    expect(lu.biens.map((bien) => bien.nom).sort()).toEqual(['Parking Prado', 'T2 Lices']);
    expect(lu.locataires).toEqual([cree.locataire]);
    expect(lu.locations).toEqual([cree.location]);
  });

  it('un corps invalide, incohérent ou illisible : 400 CHAMPS_INVALIDES, rien n’est écrit', async () => {
    const b = bancD1();
    await connecter(b, CAMILLE);
    const invalides = [
      { corps: { ...CREATION, location: null } },
      { corps: { ...CREATION, location: { ...CREATION.location, jourLoyer: 31 } } },
      { brut: '{"bien": ' },
      { brut: '' },
    ];
    for (const options of invalides) {
      const r = await b.requete('/api/gestion/locations', { method: 'POST', ...options });
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ code: 'CHAMPS_INVALIDES' });
    }
    expect(compter(b.sqlite, 'gestion_bien')).toBe(0);
  });

  it('un corps de plus de 64 Ko : 413 CORPS_TROP_GROS', async () => {
    const b = bancD1();
    await connecter(b, CAMILLE);
    const r = await b.requete('/api/gestion/locations', {
      brut: JSON.stringify({ ...CREATION, remplissage: 'x'.repeat(TAILLE_MAX_OCTETS) }),
    });
    expect(r.status).toBe(413);
    expect(await r.json()).toEqual({ code: 'CORPS_TROP_GROS' });
  });
});

describe('paiements', () => {
  it('reçu, période déjà reçue, annulation, puis introuvable', async () => {
    const b = bancD1();
    await connecter(b, CAMILLE);
    const { location } = await creerLouee(b);
    const locationId = location?.id ?? '';

    const paye = await b.requete('/api/gestion/paiements', { corps: paiementDe(locationId) });
    expect(paye.status).toBe(201);
    const paiement = await lire<Paiement>(paye);
    expect(paiement).toMatchObject({ locationId, periode: '2026-10', source: 'manuel' });

    const doublon = await b.requete('/api/gestion/paiements', { corps: paiementDe(locationId) });
    expect(doublon.status).toBe(409);
    expect(await doublon.json()).toEqual({ code: 'PERIODE_DEJA_RECUE' });
    expect((await etat(b)).paiements).toEqual([paiement]);

    const annule = await b.requete(`/api/gestion/paiements/${paiement.id}`, { method: 'DELETE' });
    expect(annule.status).toBe(204);
    expect((await etat(b)).paiements).toEqual([]);
    const encore = await b.requete(`/api/gestion/paiements/${paiement.id}`, { method: 'DELETE' });
    expect(encore.status).toBe(404);
    expect(await encore.json()).toEqual({ code: 'INTROUVABLE' });
  });

  it('un paiement invalide ou sur une location inconnue : 400 ou 404', async () => {
    const b = bancD1();
    await connecter(b, CAMILLE);
    const invalide = await b.requete('/api/gestion/paiements', {
      corps: { ...paiementDe('l1'), montant: 0 },
    });
    expect(invalide.status).toBe(400);
    const inconnue = await b.requete('/api/gestion/paiements', { corps: paiementDe('inconnue') });
    expect(inconnue.status).toBe(404);
  });

  it('accès croisé : un autre compte ne voit, ne paie ni n’annule rien', async () => {
    const a = bancD1();
    const b = bancD1({ sqlite: a.sqlite });
    await connecter(a, CAMILLE);
    await connecter(b, 'antoine.dupont@example.org');
    const { location } = await creerLouee(a);
    const locationId = location?.id ?? '';
    const paiement = await lire<Paiement>(
      await a.requete('/api/gestion/paiements', { corps: paiementDe(locationId) }),
    );

    expect(await etat(b)).toMatchObject({ biens: [], locations: [], paiements: [] });
    const payer = await b.requete('/api/gestion/paiements', {
      corps: { ...paiementDe(locationId), periode: '2026-11' },
    });
    expect(payer.status).toBe(404);
    const annuler = await b.requete(`/api/gestion/paiements/${paiement.id}`, { method: 'DELETE' });
    expect(annuler.status).toBe(404);
    expect((await etat(a)).paiements).toEqual([paiement]);
  });
});

describe('préférences du menu', () => {
  it('enregistre, relit, met à jour ; refuse de masquer les deux sections', async () => {
    const b = bancD1();
    await connecter(b, CAMILLE);
    const put = (corps: object): Promise<Response> =>
      b.requete('/api/gestion/preferences', { method: 'PUT', corps });

    const r = await put({ analyser: false, gerer: true });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ analyser: false, gerer: true });
    expect((await etat(b)).preferences).toEqual({ analyser: false, gerer: true });

    expect((await put({ analyser: true, gerer: false })).status).toBe(200);
    expect((await etat(b)).preferences).toEqual({ analyser: true, gerer: false });
    expect(compter(b.sqlite, 'gestion_preference')).toBe(1);

    const tout = await put({ analyser: false, gerer: false });
    expect(tout.status).toBe(400);
    expect((await etat(b)).preferences).toEqual({ analyser: true, gerer: false });
  });
});

describe('pannes et suppression du compte', () => {
  it('base sans les tables de gestion : 503 journalisé sans donnée personnelle, la session marche', async () => {
    const b = bancD1({ migrations: 1 });
    await connecter(b, CAMILLE);
    const r = await b.requete('/api/gestion/etat');
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ code: 'GESTION_INDISPONIBLE' });
    expect(b.journal.evenements).toContainEqual({
      niveau: 'erreur',
      evenement: 'gestion.indisponible',
      donnees: { chemin: '/api/gestion/etat' },
    });
    expect(JSON.stringify(b.journal.evenements)).not.toContain(CAMILLE);
    expect((await b.requete('/api/auth/get-session')).status).toBe(200);
  });

  it('une erreur imprévue du dépôt : 500 ERREUR_INTERNE journalisée', async () => {
    const enPanne: DepotGestion = {
      etat: () => Promise.reject(new Error('disque plein')),
      creer: () => Promise.reject(new Error('disque plein')),
      payer: () => Promise.reject(new Error('disque plein')),
      annulerPaiement: () => Promise.reject(new Error('disque plein')),
      enregistrerPreferences: () => Promise.reject(new Error('disque plein')),
    };
    const b = bancD1({ surcharges: { gestion: enPanne } });
    await connecter(b, CAMILLE);
    const r = await b.requete('/api/gestion/etat');
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ code: 'ERREUR_INTERNE' });
    expect(b.journal.evenements).toContainEqual({
      niveau: 'erreur',
      evenement: 'erreur.interne',
      donnees: { chemin: '/api/gestion/etat', raison: 'disque plein' },
    });
  });

  it('supprimer le compte supprime toutes ses données de gestion (clés étrangères en cascade)', async () => {
    const b = bancD1();
    await connecter(b, CAMILLE);
    const { location } = await creerLouee(b);
    await b.requete('/api/gestion/paiements', { corps: paiementDe(location?.id ?? '') });
    await b.requete('/api/gestion/preferences', {
      method: 'PUT',
      corps: { analyser: false, gerer: true },
    });
    const tables = [
      'gestion_bien',
      'gestion_locataire',
      'gestion_location',
      'gestion_paiement',
      'gestion_preference',
    ];
    expect(tables.map((t) => compter(b.sqlite, t))).toEqual([1, 1, 1, 1, 1]);

    expect((await b.requete('/api/auth/delete-user', { corps: {} })).status).toBe(200);
    expect(tables.map((t) => compter(b.sqlite, t))).toEqual([0, 0, 0, 0, 0]);
  });
});
