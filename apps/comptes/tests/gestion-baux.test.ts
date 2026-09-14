import type { CreationLocation, CreationReponse, EtatGestion, LocationGeree } from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import { LIMITE_LOCATIONS_PAR_BIEN } from '../src/gestion/depot-baux';
import { bancD1, compter, connecter } from './aide';

type Banc = ReturnType<typeof bancD1>;

const CAMILLE = 'camille@example.org';
/** Le 15 décembre 2026. */
const HORLOGE = { optionsDepot: { maintenant: () => '2026-12-15T09:00:00.000Z' } };

const LOUEE: CreationLocation = {
  bien: { nom: 'T2 Lices', adresse: '12 rue des Lices', type: 'appartement', meuble: true },
  locataire: { prenom: 'Julie', nom: 'Martin' },
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

const OCCUPATION = {
  locataire: { prenom: 'Léa', nom: 'Bernard', email: 'lea.bernard@exemple.fr' },
  location: {
    type: 'nue',
    debut: '2027-01-01',
    jourLoyer: 5,
    loyerHorsCharges: 12_000,
    charges: 0,
    depot: 12_000,
  },
};

async function lire<T>(reponse: Response): Promise<T> {
  return (await reponse.json()) as T;
}

async function creer(b: Banc, creation: CreationLocation): Promise<CreationReponse> {
  const r = await b.requete('/api/gestion/locations', { corps: creation });
  expect(r.status).toBe(201);
  return lire<CreationReponse>(r);
}

async function etat(b: Banc): Promise<EtatGestion> {
  return lire<EtatGestion>(await b.requete('/api/gestion/etat'));
}

function terminer(b: Banc, locationId: string, fin: string): Promise<Response> {
  return b.requete(`/api/gestion/locations/${locationId}/fin`, { corps: { fin } });
}

function louer(b: Banc, bienId: string, corps: object = OCCUPATION): Promise<Response> {
  return b.requete(`/api/gestion/biens/${bienId}/locations`, { corps });
}

async function connecte(): Promise<Banc> {
  const b = bancD1(HORLOGE);
  await connecter(b, CAMILLE);
  return b;
}

describe('fin de location', () => {
  it('enregistre la sortie, l’état la rend ; aucun loyer n’est dû après', async () => {
    const b = await connecte();
    const locationId = (await creer(b, LOUEE)).location?.id ?? '';
    const r = await terminer(b, locationId, '2027-03-14');
    expect(r.status).toBe(200);
    expect(await lire<LocationGeree>(r)).toMatchObject({ id: locationId, fin: '2027-03-14' });
    expect((await etat(b)).locations[0]?.fin).toBe('2027-03-14');
    const avril = await b.requete('/api/gestion/paiements', {
      corps: { locationId, periode: '2027-04', montant: 100, date: '2026-12-15' },
    });
    expect(avril.status).toBe(400);
  });

  it('refus : avant l’entrée 400, loyers reçus après la sortie 409, date impossible 400, autre compte 404', async () => {
    const b = await connecte();
    const locationId = (await creer(b, LOUEE)).location?.id ?? '';
    const decembre = await b.requete('/api/gestion/paiements', {
      corps: { locationId, periode: '2026-12', montant: 100, date: '2026-12-05' },
    });
    expect(decembre.status).toBe(201);

    const apres = await terminer(b, locationId, '2026-11-20');
    expect(apres.status).toBe(409);
    expect(await apres.json()).toEqual({ code: 'PAIEMENTS_APRES_SORTIE' });
    const avant = await terminer(b, locationId, '2026-09-30');
    expect(avant.status).toBe(400);
    expect(await avant.json()).toEqual({ code: 'FIN_AVANT_ENTREE' });
    expect((await terminer(b, locationId, '2027-02-30')).status).toBe(400);

    const autre = bancD1({ ...HORLOGE, sqlite: b.sqlite });
    await connecter(autre, 'antoine.dupont@example.org');
    expect((await terminer(autre, locationId, '2027-03-14')).status).toBe(404);
    expect((await etat(b)).locations[0]?.fin).toBeUndefined();
  });
});

describe('louer un bien vacant', () => {
  it('crée le locataire et la location du bien : 201, l’état les rend', async () => {
    const b = await connecte();
    const { bien } = await creer(b, VACANT);
    const r = await louer(b, bien.id);
    expect(r.status).toBe(201);
    const { locataire, location } = await lire<{
      locataire: { id: string };
      location: LocationGeree;
    }>(r);
    expect(location).toMatchObject({
      bienId: bien.id,
      locataireId: locataire.id,
      debut: '2027-01-01',
    });
    const apres = await etat(b);
    expect(apres.locataires).toEqual([expect.objectContaining({ prenom: 'Léa', nom: 'Bernard' })]);
    expect(apres.locations).toEqual([location]);
  });

  it('refus : chevauchement 409 BIEN_OCCUPE, bien d’un autre compte 404, corps invalide 400', async () => {
    const b = await connecte();
    const { bien } = await creer(b, VACANT);
    expect((await louer(b, bien.id)).status).toBe(201);
    const chevauche = await louer(b, bien.id, {
      ...OCCUPATION,
      location: { ...OCCUPATION.location, debut: '2027-06-01' },
    });
    expect(chevauche.status).toBe(409);
    expect(await chevauche.json()).toEqual({ code: 'BIEN_OCCUPE' });
    expect((await louer(b, bien.id, {})).status).toBe(400);

    const autre = bancD1({ ...HORLOGE, sqlite: b.sqlite });
    await connecter(autre, 'antoine.dupont@example.org');
    expect((await louer(autre, bien.id)).status).toBe(404);
    expect(compter(b.sqlite, 'gestion_location')).toBe(1);
  });

  it(`au-delà de ${String(LIMITE_LOCATIONS_PAR_BIEN)} locations sur un bien : 409 LIMITE_ATTEINTE`, async () => {
    const b = await connecte();
    const { bien } = await creer(b, VACANT);
    const compte = b.sqlite.prepare('select id from "user" where email = ?').get(CAMILLE);
    const userId = String(compte?.id);
    const h = '2026-12-15T09:00:00.000Z';
    b.sqlite
      .prepare(
        'insert into gestion_locataire (id, userId, prenom, nom, creeLe) values (?, ?, ?, ?, ?)',
      )
      .run('ancien', userId, 'Ancien', 'Locataire', h);
    const inserer = b.sqlite.prepare(
      'insert into gestion_location (id, userId, bienId, locataireId, type, debut, fin, jourLoyer, loyerHorsCharges, charges, depot, creeLe) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    for (let i = 0; i < LIMITE_LOCATIONS_PAR_BIEN; i += 1) {
      const annee = String(1950 + i);
      inserer.run(
        `l${String(i)}`,
        userId,
        bien.id,
        'ancien',
        'nue',
        `${annee}-01-01`,
        `${annee}-06-30`,
        5,
        10_000,
        0,
        10_000,
        h,
      );
    }
    const r = await louer(b, bien.id);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ code: 'LIMITE_ATTEINTE' });
    expect(compter(b.sqlite, 'gestion_location')).toBe(LIMITE_LOCATIONS_PAR_BIEN);
  });
});

describe('plusieurs locataires (ADR-G13)', () => {
  const LEA = { prenom: 'Léa', nom: 'Bernard' };
  const HUGO = { prenom: 'Hugo', nom: 'Petit' };

  it('colocation à bail unique : une location, ses colocataires dans l’ordre, gardés à la sortie', async () => {
    const b = await connecte();
    const cree = await creer(b, { ...LOUEE, colocataires: [LEA, HUGO] });
    expect(cree.colocataires.map((c) => c.prenom)).toEqual(['Léa', 'Hugo']);
    expect(cree.location?.colocataireIds).toEqual(cree.colocataires.map((c) => c.id));
    expect(compter(b.sqlite, 'gestion_location')).toBe(1);

    const lu = await etat(b);
    expect(lu.locations).toEqual([cree.location]);
    expect(lu.locataires.map((l) => l.prenom).sort()).toEqual(['Hugo', 'Julie', 'Léa']);

    const r = await terminer(b, cree.location?.id ?? '', '2027-03-14');
    expect(r.status).toBe(200);
    expect(await lire<LocationGeree>(r)).toMatchObject({
      fin: '2027-03-14',
      colocataireIds: cree.location?.colocataireIds,
    });
  });

  it('location à la chambre : deux chambres aux mêmes dates, jamais deux fois la même', async () => {
    const b = await connecte();
    const { bien } = await creer(b, VACANT);
    const chambre = (libelle: string, debut = OCCUPATION.location.debut): object => ({
      ...OCCUPATION,
      location: { ...OCCUPATION.location, debut, libelle },
    });
    expect((await louer(b, bien.id, chambre('Chambre 1'))).status).toBe(201);
    const deux = await louer(b, bien.id, {
      ...chambre('Chambre 2'),
      locataire: HUGO,
      colocataires: [LEA],
    });
    expect(deux.status).toBe(201);
    expect(await deux.json()).toMatchObject({
      locataire: { prenom: 'Hugo' },
      colocataires: [{ prenom: 'Léa' }],
      location: { libelle: 'Chambre 2' },
    });

    const memeChambre = await louer(b, bien.id, chambre('chambre 2', '2027-06-01'));
    expect(memeChambre.status).toBe(409);
    expect(await memeChambre.json()).toEqual({ code: 'BIEN_OCCUPE' });
    // Sans libellé, le bien loué en entier : seules les locations sans libellé le bloquent.
    expect((await louer(b, bien.id)).status).toBe(201);
    expect((await louer(b, bien.id)).status).toBe(409);
    expect(compter(b.sqlite, 'gestion_location')).toBe(3);
    expect(compter(b.sqlite, 'gestion_colocataire')).toBe(1);
  });

  it('plus de dix colocataires ou un libellé trop long : 400, rien n’est écrit', async () => {
    const b = await connecte();
    const onze = Array.from({ length: 11 }, () => LEA);
    const cree = await b.requete('/api/gestion/locations', {
      corps: { ...LOUEE, colocataires: onze },
    });
    expect(cree.status).toBe(400);
    const { bien } = await creer(b, VACANT);
    expect((await louer(b, bien.id, { ...OCCUPATION, colocataires: onze })).status).toBe(400);
    const longue = { ...OCCUPATION, location: { ...OCCUPATION.location, libelle: 'x'.repeat(41) } };
    expect((await louer(b, bien.id, longue)).status).toBe(400);
    expect(compter(b.sqlite, 'gestion_locataire')).toBe(0);
  });
});
