import type {
  CreationLocation,
  CreationReponse,
  DocumentComplet,
  EtatGestion,
  ExportGestion,
  LocationGeree,
  NouvelleLocation,
} from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import { bancD1, compter, connecter } from './aide';

type Banc = ReturnType<typeof bancD1>;

const CAMILLE = 'camille@example.org';
/** Le 15 décembre 2026. */
const HORLOGE = { optionsDepot: { maintenant: () => '2026-12-15T09:00:00.000Z' } };

const LOCATION: NouvelleLocation = {
  type: 'meublee',
  debut: '2026-10-01',
  jourLoyer: 5,
  loyerHorsCharges: 65_000,
  charges: 5_000,
  depot: 130_000,
};

function louee(location: NouvelleLocation = LOCATION): CreationLocation {
  return {
    bien: { nom: 'T2 Lices', adresse: '12 rue des Lices', type: 'appartement', meuble: true },
    locataire: { prenom: 'Julie', nom: 'Martin' },
    location,
  };
}

async function lire<T>(reponse: Response): Promise<T> {
  return (await reponse.json()) as T;
}

async function connecte(): Promise<Banc> {
  const b = bancD1(HORLOGE);
  await connecter(b, CAMILLE);
  return b;
}

async function creer(b: Banc, creation: CreationLocation = louee()): Promise<CreationReponse> {
  const r = await b.requete('/api/gestion/locations', { corps: creation });
  expect(r.status).toBe(201);
  return lire<CreationReponse>(r);
}

async function etat(b: Banc): Promise<EtatGestion> {
  return lire<EtatGestion>(await b.requete('/api/gestion/etat'));
}

function modifier(b: Banc, locationId: string, corps: object): Promise<Response> {
  return b.requete(`/api/gestion/locations/${locationId}`, { method: 'PATCH', corps });
}

function montants(aPartirDe: string, loyerHorsCharges = 65_000, apl = 0): object {
  return { montants: { aPartirDe, loyerHorsCharges, charges: 5_000, apl } };
}

function payer(b: Banc, locationId: string, periode: string, montant: number): Promise<Response> {
  return b.requete('/api/gestion/paiements', {
    corps: { locationId, periode, montant, date: '2026-12-15' },
  });
}

describe('modifier les montants à partir d’un mois', () => {
  it('nouveau loyer à partir de janvier : 200 ; l’état, l’export et les paiements suivent, décembre reste à 700 €', async () => {
    const b = await connecte();
    const id = (await creer(b)).location?.id ?? '';
    const r = await modifier(b, id, montants('2027-01', 68_000));
    expect(r.status).toBe(200);
    const changements = [
      { aPartirDe: '2027-01', loyerHorsCharges: 68_000, charges: 5_000, apl: 0 },
    ];
    expect(await lire<LocationGeree>(r)).toMatchObject({
      id,
      loyerHorsCharges: 65_000,
      changements,
    });
    expect((await etat(b)).locations[0]?.changements).toEqual(changements);
    const exporte = await lire<ExportGestion>(await b.requete('/api/gestion/export'));
    expect(exporte.locations[0]?.changements).toEqual(changements);

    expect((await payer(b, id, '2026-12', 70_001)).status).toBe(409);
    expect((await payer(b, id, '2027-01', 73_001)).status).toBe(409);
    expect((await payer(b, id, '2027-01', 73_000)).status).toBe(201);
  });

  it('un changement du même mois remplace le précédent', async () => {
    const b = await connecte();
    const id = (await creer(b)).location?.id ?? '';
    expect((await modifier(b, id, montants('2027-02', 68_000))).status).toBe(200);
    const r = await modifier(b, id, montants('2027-02', 69_000));
    expect((await lire<LocationGeree>(r)).changements).toEqual([
      { aPartirDe: '2027-02', loyerHorsCharges: 69_000, charges: 5_000, apl: 0 },
    ]);
    expect(compter(b.sqlite, 'gestion_changement')).toBe(1);
  });

  it('un mois déjà payé, ou un mois qui le précède : 409 PERIODE_PAYEE, rien n’est écrit', async () => {
    const b = await connecte();
    const id = (await creer(b)).location?.id ?? '';
    expect((await payer(b, id, '2026-12', 100)).status).toBe(201);
    for (const aPartirDe of ['2026-12', '2026-11']) {
      const r = await modifier(b, id, montants(aPartirDe, 60_000));
      expect(r.status).toBe(409);
      expect(await r.json()).toEqual({ code: 'PERIODE_PAYEE' });
    }
    expect(compter(b.sqlite, 'gestion_changement')).toBe(0);
    expect((await modifier(b, id, montants('2027-01', 60_000))).status).toBe(200);
  });

  it('bornes et validation : 400 HORS_LOCATION, 400 CHAMPS_INVALIDES, 404 hors du compte', async () => {
    const b = await connecte();
    const id = (await creer(b)).location?.id ?? '';
    for (const aPartirDe of ['2026-09', '2028-01']) {
      const r = await modifier(b, id, montants(aPartirDe));
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ code: 'HORS_LOCATION' });
    }
    expect((await modifier(b, id, {})).status).toBe(400);
    expect((await modifier(b, id, montants('2027-01', 65_000, 70_001))).status).toBe(400);
    expect((await modifier(b, 'inconnue', montants('2027-01'))).status).toBe(404);

    const autre = bancD1({ ...HORLOGE, sqlite: b.sqlite });
    await connecter(autre, 'antoine.dupont@example.org');
    expect((await modifier(autre, id, montants('2027-01'))).status).toBe(404);
    expect(compter(b.sqlite, 'gestion_changement')).toBe(0);
  });
});

describe('modifier le jour, le dépôt et le libellé', () => {
  it('seuls ces champs changent ; un libellé déjà pris sur ces dates → 409 BIEN_OCCUPE', async () => {
    const b = await connecte();
    const creation = await creer(b, louee({ ...LOCATION, libelle: 'Chambre 1' }));
    const id = creation.location?.id ?? '';
    const chambre2 = await b.requete(`/api/gestion/biens/${creation.bien.id}/locations`, {
      corps: {
        locataire: { prenom: 'Léa', nom: 'Bernard' },
        location: { ...LOCATION, debut: '2027-01-01', libelle: 'Chambre 2' },
      },
    });
    expect(chambre2.status).toBe(201);

    const jour = await modifier(b, id, { jourLoyer: 10 });
    expect(jour.status).toBe(200);
    expect(await lire<LocationGeree>(jour)).toMatchObject({
      jourLoyer: 10,
      depot: 130_000,
      libelle: 'Chambre 1',
      loyerHorsCharges: 65_000,
    });
    expect(await lire<LocationGeree>(await modifier(b, id, { depot: 65_000 }))).toMatchObject({
      jourLoyer: 10,
      depot: 65_000,
    });

    const pris = await modifier(b, id, { libelle: 'Chambre 2', jourLoyer: 12 });
    expect(pris.status).toBe(409);
    expect(await pris.json()).toEqual({ code: 'BIEN_OCCUPE' });
    expect((await etat(b)).locations.find((l) => l.id === id)).toMatchObject({
      jourLoyer: 10,
      libelle: 'Chambre 1',
    });

    expect(
      await lire<LocationGeree>(await modifier(b, id, { libelle: 'Chambre 3' })),
    ).toMatchObject({
      libelle: 'Chambre 3',
    });
    expect(await lire<LocationGeree>(await modifier(b, id, { libelle: null }))).not.toHaveProperty(
      'libelle',
    );

    // Sortie avant l'entrée de la chambre 2 : le même libellé ne chevauche plus.
    const fin = await b.requete(`/api/gestion/locations/${id}/fin`, {
      corps: { fin: '2026-12-31' },
    });
    expect(fin.status).toBe(200);
    expect((await modifier(b, id, { libelle: 'Chambre 2' })).status).toBe(200);
  });
});

describe('documents figés et APL', () => {
  it('la quittance émise garde son contenu ; l’APL saisie y figure ; le mois suivant prend les nouveaux montants', async () => {
    const b = await connecte();
    const bailleur = await b.requete('/api/gestion/bailleur', {
      method: 'PUT',
      corps: { nom: 'Pierre Georgel', adresse: '3 rue Paradis, 13006 Marseille' },
    });
    expect(bailleur.status).toBe(200);
    const creation = await creer(b, louee({ ...LOCATION, apl: 18_000 }));
    expect(creation.location).toMatchObject({ apl: 18_000, changements: [] });
    const id = creation.location?.id ?? '';

    expect((await payer(b, id, '2026-10', 70_000)).status).toBe(201);
    const emis = await b.requete('/api/gestion/documents', {
      corps: { type: 'quittance', locationId: id, periode: '2026-10' },
    });
    expect(emis.status).toBe(201);
    const octobre = await lire<DocumentComplet>(emis);
    expect(octobre.contenu).toMatchObject({ loyerHorsCharges: 65_000, total: 70_000, apl: 18_000 });

    const r = await modifier(b, id, { ...montants('2026-11', 60_000), libelle: 'Chambre 1' });
    expect(r.status).toBe(200);
    const relu = await lire<DocumentComplet>(
      await b.requete(`/api/gestion/documents/${octobre.id}`),
    );
    expect(relu.contenu).toEqual(octobre.contenu);

    expect((await payer(b, id, '2026-11', 65_000)).status).toBe(201);
    const novembre = await lire<DocumentComplet>(
      await b.requete('/api/gestion/documents', {
        corps: { type: 'quittance', locationId: id, periode: '2026-11' },
      }),
    );
    expect(novembre.contenu).toMatchObject({
      loyerHorsCharges: 60_000,
      total: 65_000,
      logement: { libelle: 'Chambre 1' },
    });
    expect(novembre.contenu).not.toHaveProperty('apl');
  });
});

describe('supprimer un bien', () => {
  const BAILLEUR = { nom: 'Pierre Georgel', adresse: '3 rue Paradis, 13006 Marseille' };
  const PARKING: CreationLocation = {
    bien: { nom: 'Parking Prado', adresse: '8 avenue du Prado', type: 'parking', meuble: false },
    locataire: null,
    location: null,
  };

  it('204 : le bien, ses locations, changements, colocataires, paiements et documents disparaissent ; ses locataires sans autre location aussi', async () => {
    const b = await connecte();
    expect(
      (await b.requete('/api/gestion/bailleur', { method: 'PUT', corps: BAILLEUR })).status,
    ).toBe(200);
    const lices = await creer(b, { ...louee(), colocataires: [{ prenom: 'Léa', nom: 'Bernard' }] });
    const id = lices.location?.id ?? '';
    expect((await modifier(b, id, montants('2027-01', 68_000))).status).toBe(200);
    expect((await payer(b, id, '2026-10', 70_000)).status).toBe(201);
    const quittance = await b.requete('/api/gestion/documents', {
      corps: { type: 'quittance', locationId: id, periode: '2026-10' },
    });
    expect(quittance.status).toBe(201);

    // Julie loue aussi le parking (écrit directement : l'API crée un locataire par location).
    const prado = await creer(b, PARKING);
    const compte = b.sqlite
      .prepare('select userId from gestion_bien where id = ?')
      .get(prado.bien.id);
    b.sqlite
      .prepare(
        'insert into gestion_location (id, userId, bienId, locataireId, type, debut, jourLoyer, loyerHorsCharges, charges, depot, creeLe) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        'l-prado',
        String(compte?.userId),
        prado.bien.id,
        lices.locataire?.id ?? '',
        'nue',
        '2026-11-01',
        5,
        8_000,
        0,
        8_000,
        '2026-11-01T08:00:00.000Z',
      );

    const r = await b.requete(`/api/gestion/biens/${lices.bien.id}`, { method: 'DELETE' });
    expect(r.status).toBe(204);
    const apres = await etat(b);
    expect(apres.biens.map((bien) => bien.nom)).toEqual(['Parking Prado']);
    expect(apres.locations.map((l) => l.id)).toEqual(['l-prado']);
    expect(apres.locataires.map((l) => l.prenom)).toEqual(['Julie']);
    expect(apres.paiements).toEqual([]);
    expect(apres.documents).toEqual([]);
    for (const table of [
      'gestion_changement',
      'gestion_colocataire',
      'gestion_paiement',
      'gestion_document',
    ]) {
      expect(compter(b.sqlite, table)).toBe(0);
    }
  });

  it('bien d’un autre compte ou inconnu : 404, rien n’est supprimé', async () => {
    const b = await connecte();
    const lices = await creer(b);
    const autre = bancD1({ ...HORLOGE, sqlite: b.sqlite });
    await connecter(autre, 'antoine.dupont@example.org');
    expect(
      (await autre.requete(`/api/gestion/biens/${lices.bien.id}`, { method: 'DELETE' })).status,
    ).toBe(404);
    expect((await b.requete('/api/gestion/biens/inconnu', { method: 'DELETE' })).status).toBe(404);
    expect(compter(b.sqlite, 'gestion_bien')).toBe(1);
    expect(compter(b.sqlite, 'gestion_locataire')).toBe(1);
    expect(compter(b.sqlite, 'gestion_location')).toBe(1);
  });
});
