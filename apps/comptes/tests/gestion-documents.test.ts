import type { D1Database } from '@cloudflare/workers-types';
import type {
  CreationLocation,
  CreationReponse,
  DocumentComplet,
  EtatGestion,
  ExportGestion,
  Paiement,
} from '@loupe/gestion';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { d1SurSqlite } from '../scripts/d1-sqlite';
import { appliquerMigrations } from '../scripts/migration';
import { depotD1 } from '../src/gestion/depot-d1';
import { bancD1, compter, connecter } from './aide';

type Banc = ReturnType<typeof bancD1>;
type Options = NonNullable<Parameters<Banc['requete']>[1]>;

const CAMILLE = 'camille@example.org';
/** Le 2 novembre 2026 : octobre est passé, ses paiements aussi. */
const MAINTENANT = '2026-11-02T09:00:00.000Z';
const HORLOGE = { optionsDepot: { maintenant: () => MAINTENANT } };
const BAILLEUR = { nom: 'Pierre Georgel', adresse: '3 rue Paradis, 13006 Marseille' };

const CREATION: CreationLocation = {
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

async function lire<T>(reponse: Response): Promise<T> {
  return (await reponse.json()) as T;
}

async function louee(b: Banc): Promise<string> {
  const r = await b.requete('/api/gestion/locations', { corps: CREATION });
  expect(r.status).toBe(201);
  return (await lire<CreationReponse>(r)).location?.id ?? '';
}

async function payer(
  b: Banc,
  locationId: string,
  montant: number,
  date: string,
): Promise<Paiement> {
  const r = await b.requete('/api/gestion/paiements', {
    corps: { locationId, periode: '2026-10', montant, date },
  });
  expect(r.status).toBe(201);
  return lire<Paiement>(r);
}

function bailleur(b: Banc, identite: object = BAILLEUR): Promise<Response> {
  return b.requete('/api/gestion/bailleur', { method: 'PUT', corps: identite });
}

function emettre(b: Banc, corps: object): Promise<Response> {
  return b.requete('/api/gestion/documents', { corps });
}

async function etat(b: Banc): Promise<EtatGestion> {
  return lire<EtatGestion>(await b.requete('/api/gestion/etat'));
}

async function pret(): Promise<{ b: Banc; locationId: string }> {
  const b = bancD1(HORLOGE);
  await connecter(b, CAMILLE);
  return { b, locationId: await louee(b) };
}

describe('identité du bailleur', () => {
  it('absente au départ, enregistrée, mise à jour ; un nom vide est refusé', async () => {
    const { b } = await pret();
    expect((await etat(b)).bailleur).toBeNull();
    const r = await bailleur(b);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual(BAILLEUR);
    const demenage = { ...BAILLEUR, adresse: '5 rue Sainte, 13001 Marseille' };
    expect((await bailleur(b, demenage)).status).toBe(200);
    expect((await etat(b)).bailleur).toEqual(demenage);
    expect(compter(b.sqlite, 'gestion_bailleur')).toBe(1);
    expect((await bailleur(b, { nom: ' ', adresse: 'x' })).status).toBe(400);
  });
});

describe('quittances', () => {
  it('mois payé : 201, puis 200 avec le même document ; l’état le liste sans son contenu', async () => {
    const { b, locationId } = await pret();
    await bailleur(b);
    await payer(b, locationId, 70_000, '2026-10-05');

    const premiere = await emettre(b, { type: 'quittance', locationId, periode: '2026-10' });
    expect(premiere.status).toBe(201);
    const document = await lire<DocumentComplet>(premiere);
    expect(document).toMatchObject({
      type: 'quittance',
      locationId,
      periode: '2026-10',
      emisLe: MAINTENANT,
      contenu: {
        emisLe: '2026-11-02',
        bailleur: BAILLEUR,
        locataire: { prenom: 'Julie', nom: 'Martin' },
        logement: { nom: 'T2 Lices', adresse: '12 rue des Lices' },
        loyerHorsCharges: 65_000,
        charges: 5_000,
        total: 70_000,
        montantRecu: 70_000,
        mentions: ['pour_acquit'],
      },
    });
    expect(document.numero).toMatch(/^Q-202610-[A-Z0-9]{8}$/);

    const encore = await emettre(b, { type: 'quittance', locationId, periode: '2026-10' });
    expect(encore.status).toBe(200);
    expect(await encore.json()).toEqual(document);
    expect((await etat(b)).documents).toEqual([
      {
        id: document.id,
        type: 'quittance',
        numero: document.numero,
        locationId,
        periode: '2026-10',
        emisLe: MAINTENANT,
      },
    ]);
    expect(compter(b.sqlite, 'gestion_document')).toBe(1);
  });

  it('contenu figé : renommer le bien ou changer d’adresse ne change pas une quittance émise', async () => {
    const { b, locationId } = await pret();
    await bailleur(b);
    await payer(b, locationId, 70_000, '2026-10-05');
    const document = await lire<DocumentComplet>(
      await emettre(b, { type: 'quittance', locationId, periode: '2026-10' }),
    );
    b.sqlite.prepare('update gestion_bien set nom = ?, adresse = ?').run('Autre', 'Ailleurs');
    await bailleur(b, { nom: 'Quelqu’un d’autre', adresse: 'Paris' });
    const relu = await b.requete(`/api/gestion/documents/${document.id}`);
    expect(relu.status).toBe(200);
    expect(await relu.json()).toEqual(document);
  });

  it('refus : sans bailleur 409, loyer pas entièrement reçu 409, hors location 400, location inconnue 404, corps invalide 400', async () => {
    const { b, locationId } = await pret();
    await payer(b, locationId, 30_000, '2026-10-06');
    const demande = { type: 'quittance', locationId, periode: '2026-10' };

    const sansBailleur = await emettre(b, demande);
    expect(sansBailleur.status).toBe(409);
    expect(await sansBailleur.json()).toEqual({ code: 'BAILLEUR_MANQUANT' });
    await bailleur(b);
    const nonRegle = await emettre(b, demande);
    expect(nonRegle.status).toBe(409);
    expect(await nonRegle.json()).toEqual({ code: 'LOYER_NON_REGLE' });
    const avantEntree = await emettre(b, { ...demande, periode: '2026-09' });
    expect(avantEntree.status).toBe(400);
    expect(await avantEntree.json()).toEqual({ code: 'HORS_LOCATION' });
    expect((await emettre(b, { ...demande, locationId: 'inconnue' })).status).toBe(404);
    expect((await emettre(b, { type: 'avis', locationId })).status).toBe(400);
    expect((await b.requete('/api/gestion/documents/inconnu')).status).toBe(404);
    expect(compter(b.sqlite, 'gestion_document')).toBe(0);
  });
});

describe('dernier mois d’un locataire qui part', () => {
  it('sortie le 20 octobre : la quittance couvre du 1er au 20, au prorata', async () => {
    const b = bancD1(HORLOGE);
    await connecter(b, CAMILLE);
    const r = await b.requete('/api/gestion/locations', {
      corps: { ...CREATION, location: { ...CREATION.location, fin: '2026-10-20' } },
    });
    const locationId = (await lire<CreationReponse>(r)).location?.id ?? '';
    await bailleur(b);
    // 65 000 × 20 ÷ 31 → 41 935 ; 5 000 × 20 ÷ 31 → 3 226 : 45 161 centimes.
    await payer(b, locationId, 45_161, '2026-10-20');
    const quittance = await emettre(b, { type: 'quittance', locationId, periode: '2026-10' });
    expect(quittance.status).toBe(201);
    expect((await lire<DocumentComplet>(quittance)).contenu).toMatchObject({
      debut: '2026-10-01',
      fin: '2026-10-20',
      loyerHorsCharges: 41_935,
      charges: 3_226,
      total: 45_161,
    });
  });
});

describe('reçus', () => {
  it('un reçu par paiement partiel ; le paiement qui solde le mois appelle une quittance', async () => {
    const { b, locationId } = await pret();
    await bailleur(b);
    const p1 = await payer(b, locationId, 30_000, '2026-10-06');

    const recu = await emettre(b, { type: 'recu', paiementId: p1.id });
    expect(recu.status).toBe(201);
    expect(await recu.json()).toMatchObject({
      type: 'recu',
      paiementId: p1.id,
      contenu: { montantRecu: 30_000, dejaRecu: 0, resteDu: 40_000, mentions: [] },
    });

    const p2 = await payer(b, locationId, 40_000, '2026-10-20');
    const solde = await emettre(b, { type: 'recu', paiementId: p2.id });
    expect(solde.status).toBe(409);
    expect(await solde.json()).toEqual({ code: 'LOYER_REGLE' });
    const quittance = await emettre(b, { type: 'quittance', locationId, periode: '2026-10' });
    expect(quittance.status).toBe(201);
    expect((await lire<DocumentComplet>(quittance)).contenu.mentions).toEqual([
      'pour_acquit',
      'annule_recus',
    ]);
    expect((await emettre(b, { type: 'recu', paiementId: 'inconnu' })).status).toBe(404);
  });
});

describe('accès croisé, course et export', () => {
  it('un autre compte ne lit ni n’émet les documents d’un compte', async () => {
    const a = bancD1(HORLOGE);
    const b = bancD1({ ...HORLOGE, sqlite: a.sqlite });
    await connecter(a, CAMILLE);
    await connecter(b, 'antoine.dupont@example.org');
    const locationId = await louee(a);
    await bailleur(a);
    await bailleur(b);
    const paiement = await payer(a, locationId, 70_000, '2026-10-05');
    const demande = { type: 'quittance', locationId, periode: '2026-10' };
    const document = await lire<DocumentComplet>(await emettre(a, demande));

    expect(await (await a.requete(`/api/gestion/documents/${document.id}`)).json()).toEqual(
      document,
    );
    expect((await b.requete(`/api/gestion/documents/${document.id}`)).status).toBe(404);
    expect((await emettre(b, demande)).status).toBe(404);
    expect((await emettre(b, { type: 'recu', paiementId: paiement.id })).status).toBe(404);
    expect((await etat(b)).documents).toEqual([]);
  });

  it('course : si un autre onglet émet entre-temps, le document déjà écrit est rendu', async () => {
    const sqlite = new DatabaseSync(':memory:');
    appliquerMigrations(sqlite);
    sqlite
      .prepare(
        'insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, ?, ?, ?, ?, ?)',
      )
      .run('u1', 'Camille', CAMILLE, 1, MAINTENANT, MAINTENANT);
    const d1 = d1SurSqlite(sqlite).base;
    const outils = { maintenant: () => MAINTENANT };
    const depot = depotD1(d1, outils);
    const { location } = await depot.creer('u1', CREATION);
    const locationId = location?.id ?? '';
    await depot.enregistrerBailleur('u1', BAILLEUR);
    await depot.payer('u1', {
      locationId,
      periode: '2026-10',
      montant: 70_000,
      date: '2026-10-05',
    });
    const demande = { type: 'quittance', locationId, periode: '2026-10' } as const;
    const premier = await depot.emettreDocument('u1', demande);

    // La première lecture par clé ne voit rien (l'autre onglet n'avait pas encore écrit).
    let masquer = true;
    const enCourse = {
      prepare: (sql: string) => {
        if (
          masquer &&
          sql.startsWith('select * from gestion_document where userId = ? and cle = ?')
        ) {
          masquer = false;
          return { bind: () => ({ all: () => Promise.resolve({ results: [] }) }) };
        }
        return d1.prepare(sql);
      },
      batch: (instructions: Parameters<D1Database['batch']>[0]) => d1.batch(instructions),
    } as unknown as D1Database;
    const second = await depotD1(enCourse, outils).emettreDocument('u1', demande);
    expect(second).toEqual({ document: premier.document, nouveau: false });
    expect(compter(sqlite, 'gestion_document')).toBe(1);
  });

  it('export : un fichier JSON en pièce jointe, documents complets compris, sans en-tête Origin', async () => {
    const { b, locationId } = await pret();
    await bailleur(b);
    await payer(b, locationId, 70_000, '2026-10-05');
    const document = await lire<DocumentComplet>(
      await emettre(b, { type: 'quittance', locationId, periode: '2026-10' }),
    );

    const r = await b.requete('/api/gestion/export', { origine: null });
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Disposition')).toBe(
      'attachment; filename="deklic-gestion-2026-11-02.json"',
    );
    const exporte = await lire<ExportGestion>(r);
    expect(exporte).toMatchObject({
      exporteLe: MAINTENANT,
      bailleur: BAILLEUR,
      preferences: { analyser: true, gerer: true },
    });
    expect(exporte.biens).toHaveLength(1);
    expect(exporte.locataires).toHaveLength(1);
    expect(exporte.paiements).toHaveLength(1);
    expect(exporte.documents).toEqual([document]);
  });

  it('sans session : 401 sur les routes des documents, des baux et de l’export', async () => {
    const b = bancD1(HORLOGE);
    const routes: [string, Options][] = [
      ['/api/gestion/bailleur', { method: 'PUT', corps: BAILLEUR }],
      ['/api/gestion/documents', { corps: { type: 'recu', paiementId: 'p1' } }],
      ['/api/gestion/documents/d1', {}],
      ['/api/gestion/export', {}],
      ['/api/gestion/locations/l1/fin', { corps: { fin: '2027-01-01' } }],
      ['/api/gestion/biens/b1/locations', { corps: {} }],
    ];
    for (const [chemin, options] of routes) {
      expect((await b.requete(chemin, options)).status, chemin).toBe(401);
    }
  });
});
