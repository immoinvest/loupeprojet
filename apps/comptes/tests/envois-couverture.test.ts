import type { D1Database } from '@cloudflare/workers-types';
import type { CreationLocation, CreationReponse, DocumentComplet, Paiement } from '@loupe/gestion';
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { d1SurSqlite } from '../scripts/d1-sqlite';
import { appliquerMigrations } from '../scripts/migration';
import type { Envoyeur } from '../src/courriel';
import { attendreVraiment, dependancesDepuisEnv, type Dependances } from '../src/dependances';
import type { EnvGestion } from '../src/gestion/acces';
import { depotD1 } from '../src/gestion/depot-d1';
import { declencheursEnvois } from '../src/gestion/envois/declencheurs';
import { estTableEnvoisAbsente } from '../src/gestion/envois/depot';
import { depotEnvoisD1 } from '../src/gestion/envois/depot-d1';
import { envoyerQuittanceDuMois } from '../src/gestion/envois/quittances';
import {
  bancD1,
  compter,
  connecter,
  envoyeurMemoire,
  type BancD1,
  type OptionsBancD1,
} from './aide';

const CAMILLE = 'camille@example.org';
const HORLOGE = { maintenant: (): string => '2026-11-02T09:00:00.000Z' };
const BAILLEUR = { nom: 'Pierre Georgel', adresse: '3 rue Paradis, 13006 Marseille' };
const SUJET_INVITATION = 'Vos quittances de loyer par e-mail';
const SUJET_QUITTANCE = 'Votre quittance de loyer – octobre 2026';

const LOCATION: NonNullable<CreationLocation['location']> = {
  type: 'meublee',
  debut: '2026-10-01',
  jourLoyer: 5,
  loyerHorsCharges: 65_000,
  charges: 5_000,
  depot: 130_000,
};

const CREATION: CreationLocation = {
  bien: { nom: 'T2 Lices', adresse: '12 rue des Lices', type: 'appartement', meuble: true },
  locataire: { prenom: 'Julie', nom: 'Martin', email: 'julie@exemple.fr' },
  location: LOCATION,
};

async function lire<T>(reponse: Response): Promise<T> {
  return (await reponse.json()) as T;
}

async function pret(options: OptionsBancD1 = {}): Promise<BancD1> {
  const b = bancD1({ optionsDepot: HORLOGE, ...options });
  await connecter(b, CAMILLE);
  return b;
}

async function creer(b: BancD1, creation: CreationLocation = CREATION): Promise<CreationReponse> {
  const r = await b.requete('/api/gestion/locations', { corps: creation });
  expect(r.status).toBe(201);
  await b.taches();
  return lire<CreationReponse>(r);
}

async function payer(b: BancD1, locationId: string, montant: number): Promise<Paiement> {
  const r = await b.requete('/api/gestion/paiements', {
    corps: { locationId, periode: '2026-10', montant, date: '2026-10-05' },
  });
  expect(r.status).toBe(201);
  return lire<Paiement>(r);
}

function identifiantDuCompte(b: BancD1): string {
  return String(b.sqlite.prepare('select id from "user"').get()?.id);
}

/** Une base migrée, à partager entre un banc et un dépôt construit à la main. */
function baseMigree(): DatabaseSync {
  const sqlite = new DatabaseSync(':memory:');
  appliquerMigrations(sqlite);
  return sqlite;
}

describe('déclencheurs (intergiciel)', () => {
  function application(deps: Dependances, corps: unknown, statut = 201): Hono<EnvGestion> {
    const app = new Hono<EnvGestion>();
    app.use('*', async (c, next) => {
      c.set('userId', 'u1');
      await next();
    });
    app.use('*', declencheursEnvois(deps));
    app.all('*', (c) =>
      c.body(JSON.stringify(corps), statut as ContentfulStatusCode, {
        'Content-Type': 'application/json',
      }),
    );
    return app;
  }

  function contexte(): {
    readonly taches: Promise<unknown>[];
    readonly ctx: Parameters<Hono['request']>[3];
  } {
    const taches: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => {
        taches.push(p);
      },
      passThroughOnException: () => undefined,
      props: {},
    } as unknown as Parameters<Hono['request']>[3];
    return { taches, ctx };
  }

  it('sans contexte d’exécution (serveur Node), la réponse part quand même', async () => {
    const { deps } = bancD1();
    const app = application({ ...deps, courriel: null }, { locationId: 'l', periode: '2026-10' });
    const r = await app.request('http://localhost:5173/api/gestion/paiements', { method: 'POST' });
    expect(r.status).toBe(201);
  });

  it('aucune tâche pour une lecture, un refus, une réponse illisible ou une autre route', async () => {
    const { deps } = bancD1();
    const { taches, ctx } = contexte();
    const cas: readonly [string, string, unknown, number][] = [
      ['GET', '/api/gestion/paiements', {}, 200],
      ['POST', '/api/gestion/paiements', { locationId: 'l', periode: '2026-10' }, 409],
      ['POST', '/api/gestion/paiements', {}, 201],
      ['POST', '/api/gestion/locations', { locataire: null, colocataires: [] }, 201],
      ['POST', '/api/gestion/biens/b/locations', { illisible: true }, 201],
      ['PATCH', '/api/gestion/locataires/t', {}, 200],
      ['POST', '/api/gestion/documents', { id: 'd' }, 201],
    ];
    for (const [method, chemin, corps, statut] of cas) {
      const r = await application(deps, corps, statut).request(
        `http://localhost:5173${chemin}`,
        { method },
        undefined,
        ctx,
      );
      expect(r.status).toBe(statut);
    }
    expect(taches).toEqual([]);
  });

  it('une panne quelconque d’une tâche est journalisée sans adresse ; la table absente, en info', async () => {
    const b = bancD1();
    for (const [message, attendu] of [
      ['panne vers julie@exemple.fr', 'envois.tache'],
      ['no such table: gestion_accord', 'envois.indisponible'],
    ] as const) {
      const deps: Dependances = {
        ...b.deps,
        envois: { ...b.deps.envois, accords: () => Promise.reject(new Error(message)) },
      };
      const { taches, ctx } = contexte();
      await application(deps, { locataire: { id: 't1' }, colocataires: [{ id: 't2' }] }).request(
        'http://localhost:5173/api/gestion/biens/b1/locations',
        { method: 'POST' },
        undefined,
        ctx,
      );
      await Promise.all(taches);
      expect(b.journal.evenements.some((e) => e.evenement === attendu)).toBe(true);
    }
    expect(JSON.stringify(b.journal.evenements)).not.toContain('julie@');
    expect(estTableEnvoisAbsente('no such table: gestion_accord')).toBe(false);
  });
});

describe('quittances : chemins de côté', () => {
  it('sans envoyeur ou pour une location inconnue, rien ne se passe', async () => {
    const b = await pret();
    const ctx = { deps: b.deps, userId: identifiantDuCompte(b), origine: 'http://localhost:5173' };
    await expect(
      envoyerQuittanceDuMois({ ...ctx, deps: { ...b.deps, courriel: null } }, 'x', '2026-10'),
    ).resolves.toBeUndefined();
    await expect(envoyerQuittanceDuMois(ctx, 'inconnue', '2026-10')).resolves.toBeUndefined();
    expect(b.courriel.messages.filter((m) => m.sujet === SUJET_QUITTANCE)).toEqual([]);
  });

  it('une panne à l’émission est journalisée ; une quittance déjà envoyée ne repart pas ; sans adresse de réponse', async () => {
    const sqlite = baseMigree();
    const gestion = depotD1(d1SurSqlite(sqlite).base, HORLOGE);
    const enPanne = await pret({
      sqlite,
      surcharges: {
        gestion: { ...gestion, emettreDocument: () => Promise.reject(new Error('panne')) },
      },
    });
    const cree = await creer(enPanne);
    await enPanne.requete(`/api/gestion/envois/locataires/${cree.locataire?.id ?? ''}/accord`, {
      corps: {},
    });
    await payer(enPanne, cree.location?.id ?? '', 70_000);
    await enPanne.taches();
    expect(enPanne.journal.evenements).toContainEqual({
      niveau: 'erreur',
      evenement: 'envois.tache',
      donnees: { raison: 'panne' },
    });

    // Sans adresse de réponse connue : une autre base, un dépôt des envois dont l'e-mail du compte manque.
    const seconde = baseMigree();
    const envoisSansReponse = depotEnvoisD1(d1SurSqlite(seconde).base);
    const autre = await pret({
      sqlite: seconde,
      surcharges: {
        envois: { ...envoisSansReponse, emailCompte: () => Promise.resolve(null) },
      },
    });
    const location = await creer(autre);
    await autre.requete(`/api/gestion/envois/locataires/${location.locataire?.id ?? ''}/accord`, {
      corps: {},
    });
    await autre.requete('/api/gestion/bailleur', { method: 'PUT', corps: BAILLEUR });
    await payer(autre, location.location?.id ?? '', 70_000);
    await autre.taches();
    const quittances = autre.courriel.messages.filter((m) => m.sujet === SUJET_QUITTANCE);
    expect(quittances).toHaveLength(1);
    expect(quittances[0]?.repondreA).toBeUndefined();

    await envoyerQuittanceDuMois(
      { deps: autre.deps, userId: identifiantDuCompte(autre), origine: 'http://localhost:5173' },
      location.location?.id ?? '',
      '2026-10',
    );
    expect(autre.courriel.messages.filter((m) => m.sujet === SUJET_QUITTANCE)).toHaveLength(1);
  });

  it('renvoyer un reçu : introuvable ; renvoyer sans accord : refusé', async () => {
    const b = await pret();
    const { location } = await creer(b);
    const locationId = location?.id ?? '';
    await b.requete('/api/gestion/bailleur', { method: 'PUT', corps: BAILLEUR });
    const partiel = await payer(b, locationId, 30_000);
    const recu = await b.requete('/api/gestion/documents', {
      corps: { type: 'recu', paiementId: partiel.id },
    });
    const recuId = (await lire<DocumentComplet>(recu)).id;
    expect(
      (await b.requete(`/api/gestion/envois/documents/${recuId}/renvoyer`, { corps: {} })).status,
    ).toBe(404);

    await payer(b, locationId, 40_000);
    await b.taches();
    const q = await b.requete('/api/gestion/documents', {
      corps: { type: 'quittance', locationId, periode: '2026-10' },
    });
    const sansAccord = await b.requete(
      `/api/gestion/envois/documents/${(await lire<DocumentComplet>(q)).id}/renvoyer`,
      { corps: {} },
    );
    expect(sansAccord.status).toBe(409);
    expect(await sansAccord.json()).toEqual({ code: 'SANS_ACCORD' });
  });
});

describe('routes, invitations et page publique : chemins de côté', () => {
  it('une panne quelconque rend 500 sans détail ; un bailleur mal formé, 400', async () => {
    const sqlite = baseMigree();
    const envois = depotEnvoisD1(d1SurSqlite(sqlite).base);
    const b = await pret({
      sqlite,
      surcharges: { envois: { ...envois, locataires: () => Promise.reject(new Error('panne')) } },
    });
    const r = await b.requete('/api/gestion/envois');
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ code: 'ERREUR_INTERNE' });
    expect(
      (
        await b.requete('/api/gestion/envois/biens/x/bailleur', {
          method: 'PUT',
          corps: { bailleur: { type: 'societe' } },
        })
      ).status,
    ).toBe(400);
  });

  it('une invitation refusée par le fournisseur : « Renvoyer la demande » rend 502 ; 24 h plus tard, elle repart', async () => {
    const memoire = envoyeurMemoire();
    const courriel: Envoyeur = {
      envoyer: (message) =>
        // Une panne quelconque (pas une réponse de Resend) : le journal dit « statut 0 ».
        message.sujet === SUJET_INVITATION
          ? Promise.reject(new Error('réseau coupé'))
          : memoire.envoyer(message),
    };
    const b = bancD1({ optionsDepot: HORLOGE, surcharges: { courriel } });
    await b.requete('/api/auth/email-otp/send-verification-otp', {
      corps: { email: CAMILLE, type: 'sign-in' },
    });
    await b.requete('/api/auth/sign-in/email-otp', {
      corps: { email: CAMILLE, otp: memoire.dernierCode() },
    });
    const { locataire } = await creer(b);
    const id = locataire?.id ?? '';
    const echec = await b.requete(`/api/gestion/envois/locataires/${id}/invitation`, { corps: {} });
    expect(echec.status).toBe(502);
    expect(await echec.json()).toEqual({ code: 'ENVOI_ECHOUE' });
    expect(compter(b.sqlite, 'gestion_accord')).toBe(0);

    const normal = await pret();
    const cree = await creer(normal);
    const plusTard = bancD1({
      sqlite: normal.sqlite,
      optionsDepot: HORLOGE,
      surcharges: { maintenant: () => Date.now() + 25 * 3_600_000 },
    });
    await connecter(plusTard, CAMILLE);
    const encore = await plusTard.requete(
      `/api/gestion/envois/locataires/${cree.locataire?.id ?? ''}/invitation`,
      { corps: {} },
    );
    expect(encore.status).toBe(200);
    expect(await encore.json()).toMatchObject({ statut: 'en_attente' });
    expect(plusTard.courriel.messages.filter((m) => m.sujet === SUJET_INVITATION)).toHaveLength(1);
  });

  it('page publique : corps trop gros, adresse retirée depuis l’invitation', async () => {
    const b = await pret();
    const { locataire } = await creer(b);
    const invitation = b.courriel.messages.find((m) => m.sujet === SUJET_INVITATION);
    const jeton = /\/accord#(\S+)/.exec(invitation?.texte ?? '')?.[1] ?? '';
    expect(
      (await b.requete('/api/accord/lire', { brut: JSON.stringify({ jeton: 'x'.repeat(3000) }) }))
        .status,
    ).toBe(413);
    await b.requete(`/api/gestion/locataires/${locataire?.id ?? ''}`, {
      method: 'PATCH',
      corps: { prenom: 'Julie', nom: 'Martin' },
    });
    expect((await b.requete('/api/accord/lire', { corps: { jeton } })).status).toBe(410);
  });
});

describe('dépôts et dépendances', () => {
  it('contexte d’invitation : inconnu, puis chambre et SCI', async () => {
    const b = await pret();
    const envois = depotEnvoisD1(d1SurSqlite(b.sqlite).base);
    const userId = identifiantDuCompte(b);
    expect(await envois.contexteInvitation(userId, 'inconnu')).toEqual({
      bailleur: null,
      logement: null,
    });
    expect(await envois.emailCompte('compte-inconnu')).toBeNull();
    const { bien, locataire } = await creer(b, {
      ...CREATION,
      location: { ...LOCATION, libelle: 'Chambre 2' },
    });
    await b.requete(`/api/gestion/envois/biens/${bien.id}/bailleur`, {
      method: 'PUT',
      corps: { bailleur: { type: 'sci', nom: 'SCI Lices', adresse: 'Marseille' } },
    });
    expect(await envois.contexteInvitation(userId, locataire?.id ?? '')).toEqual({
      bailleur: 'SCI Lices',
      logement: 'T2 Lices · Chambre 2, 12 rue des Lices',
    });
  });

  it('un accord déclaré sans invitation préalable n’a pas de date d’invitation', async () => {
    const b = await pret({ surcharges: { jetons: null } });
    const { locataire } = await creer(b);
    const id = locataire?.id ?? '';
    expect(
      (await b.requete(`/api/gestion/envois/locataires/${id}/accord`, { corps: {} })).status,
    ).toBe(200);
    const etat = await lire<{ accords: Record<string, unknown>[] }>(
      await b.requete('/api/gestion/envois'),
    );
    expect(etat.accords).toEqual([
      { locataireId: id, statut: 'declare_par_bailleur', le: expect.any(String) as string },
    ]);
  });

  it('un jeton consommé deux fois en même temps ne sert qu’une fois', async () => {
    const b = await pret();
    await creer(b);
    const envois = depotEnvoisD1(d1SurSqlite(b.sqlite).base);
    const id = String(b.sqlite.prepare('select id from gestion_jeton').get()?.id);
    const maintenant = new Date().toISOString();
    const resultats = await Promise.all([
      envois.consommerJeton(id, maintenant),
      envois.consommerJeton(id, maintenant),
    ]);
    expect(resultats.filter((r) => r !== null)).toHaveLength(1);
  });

  it('l’émission d’un document ne masque qu’une table absente, pas une autre panne', async () => {
    const b = await pret();
    const { location } = await creer(b);
    const d1 = d1SurSqlite(b.sqlite).base;
    const enPanne = {
      prepare: (sql: string) =>
        sql.includes('gestion_bien_bailleur')
          ? { bind: () => ({ all: () => Promise.reject(new Error('disque plein')) }) }
          : d1.prepare(sql),
      batch: (instructions: Parameters<D1Database['batch']>[0]) => d1.batch(instructions),
    } as unknown as D1Database;
    await expect(
      depotD1(enPanne, HORLOGE).emettreDocument(identifiantDuCompte(b), {
        type: 'quittance',
        locationId: location?.id ?? '',
        periode: '2026-10',
      }),
    ).rejects.toThrow('disque plein');
  });

  it('clé des liens d’accord : secret posé, secret fixe en dev, aucune clé hors dev ; attente réelle', async () => {
    const DB = {} as D1Database;
    const secret = 's'.repeat(32);
    expect(dependancesDepuisEnv({ DB, ENVIRONNEMENT: 'dev' }).jetons).not.toBeNull();
    expect(dependancesDepuisEnv({ DB, BETTER_AUTH_SECRET: secret }).jetons).toBeNull();
    expect(
      dependancesDepuisEnv({ DB, BETTER_AUTH_SECRET: secret, JETON_COURRIEL_SECRET: secret })
        .jetons,
    ).not.toBeNull();
    await expect(attendreVraiment(1)).resolves.toBeUndefined();
  });
});
