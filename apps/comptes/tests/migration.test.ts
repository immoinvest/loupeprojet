import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import {
  appliquerMigrations,
  compilerMigration,
  contenuMigration,
  lireMigration,
  MIGRATIONS,
} from '../scripts/migration';
import { banc } from './aide';
import { d1SurSqlite } from './d1';

const EMAIL = 'camille@example.org';

function noms(base: DatabaseSync, type: 'table' | 'index'): unknown[] {
  return base
    .prepare(
      "select name from sqlite_master where type = ? and name not like 'sqlite_%' order by name",
    )
    .all(type)
    .map((ligne) => ligne.name);
}

describe('migration D1', () => {
  it('le fichier versionné correspond exactement au schéma attendu par Better Auth', async () => {
    expect(lireMigration()).toBe(contenuMigration(await compilerMigration()));
  });

  it('s’applique sur une base vide : quatre tables et leurs index', () => {
    const base = new DatabaseSync(':memory:');
    base.exec(lireMigration());
    expect(noms(base, 'table')).toEqual(['account', 'session', 'user', 'verification']);
    expect(noms(base, 'index')).toEqual([
      'account_userId_idx',
      'session_userId_idx',
      'verification_identifier_idx',
    ]);
  });

  it('le parcours complet passe par l’interface D1 : code, session, renommage, suppression', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(lireMigration());
    const d1 = d1SurSqlite(sqlite);
    const b = banc({ base: d1.base });

    const envoi = await b.requete('/api/auth/email-otp/send-verification-otp', {
      corps: { email: EMAIL, type: 'sign-in' },
    });
    expect(envoi.status).toBe(200);
    expect(sqlite.prepare('select count(*) as n from verification').get()).toEqual({ n: 1 });

    const connexion = await b.requete('/api/auth/sign-in/email-otp', {
      corps: { email: EMAIL, otp: b.courriel.dernierCode() },
    });
    expect(connexion.status).toBe(200);
    const ouverte = (await (await b.requete('/api/auth/get-session')).json()) as {
      user: { email: string };
    };
    expect(ouverte.user.email).toBe(EMAIL);

    expect((await b.requete('/api/auth/update-user', { corps: { name: 'Camille' } })).status).toBe(
      200,
    );
    expect(sqlite.prepare('select name, email, emailVerified from "user"').all()).toEqual([
      { name: 'Camille', email: EMAIL, emailVerified: 1 },
    ]);
    expect(sqlite.prepare('select count(*) as n from session').get()).toEqual({ n: 1 });

    expect((await b.requete('/api/auth/delete-user', { corps: {} })).status).toBe(200);
    expect(sqlite.prepare('select count(*) as n from "user"').get()).toEqual({ n: 0 });
    expect(sqlite.prepare('select count(*) as n from session').get()).toEqual({ n: 0 });

    // Les requêtes sont bien passées par l'interface D1 (et non par node:sqlite directement).
    expect(d1.requetes.some((sql) => sql.startsWith('insert into "user"'))).toBe(true);
    expect(b.journal.evenements.filter((e) => e.niveau === 'erreur')).toEqual([]);
  });
});

describe('migration 0002 : gestion locative', () => {
  it('s’applique après 0001 : cinq tables gestion_* et leurs index', () => {
    const base = new DatabaseSync(':memory:');
    appliquerMigrations(base, 2);
    expect(noms(base, 'table')).toEqual([
      'account',
      'gestion_bien',
      'gestion_locataire',
      'gestion_location',
      'gestion_paiement',
      'gestion_preference',
      'session',
      'user',
      'verification',
    ]);
    expect(noms(base, 'index')).toEqual([
      'account_userId_idx',
      'gestion_bien_userId_idx',
      'gestion_locataire_userId_idx',
      'gestion_location_bienId_idx',
      'gestion_location_userId_idx',
      'gestion_paiement_userId_idx',
      'session_userId_idx',
      'verification_identifier_idx',
    ]);
  });

  it('appliquerMigrations est rejouable et sait s’arrêter à une migration donnée', () => {
    const base = new DatabaseSync(':memory:');
    appliquerMigrations(base, 1);
    expect(noms(base, 'table')).not.toContain('gestion_bien');
    appliquerMigrations(base);
    appliquerMigrations(base);
    expect(noms(base, 'table')).toContain('gestion_bien');
    // 0003 (G1b) et 0004 (synchronisation des projets) sont indépendantes : l'ordre des numéros suffit.
    expect(MIGRATIONS.map((m) => m.fichier)).toEqual([
      '0001_comptes.sql',
      '0002_gestion.sql',
      '0003_gestion_documents.sql',
      '0004_projets.sql',
      '0005_gestion_changements.sql',
    ]);
  });

  it('migration 0004 : pas de projet sans compte, un même identifiant par compte', () => {
    const base = new DatabaseSync(':memory:');
    appliquerMigrations(base);
    const inserer = base.prepare(
      'insert into projet (userId, id, contenu, modifieLe, revision, supprime) values (?, ?, ?, ?, ?, ?)',
    );
    expect(() => inserer.run('inconnu', 'p1', '{}', 'x', 1, 0)).toThrow(
      /FOREIGN KEY constraint failed/,
    );
  });

  it('les clés étrangères sont appliquées : pas de bien sans compte', () => {
    const base = new DatabaseSync(':memory:');
    appliquerMigrations(base);
    expect(() =>
      base
        .prepare(
          'insert into gestion_bien (id, userId, nom, adresse, type, meuble, creeLe, modifieLe) values (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run('b1', 'inconnu', 'T2', '12 rue des Lices', 'appartement', 1, 'x', 'x'),
    ).toThrow(/FOREIGN KEY constraint failed/);
  });
});

describe('migration 0003 : paiements partiels, bailleur, documents', () => {
  const H = '2026-10-06T08:00:00.000Z';
  const SQL = {
    compte:
      'insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, ?, ?, ?, ?, ?)',
    bien: 'insert into gestion_bien (id, userId, nom, adresse, type, meuble, creeLe, modifieLe) values (?, ?, ?, ?, ?, ?, ?, ?)',
    locataire:
      'insert into gestion_locataire (id, userId, prenom, nom, creeLe) values (?, ?, ?, ?, ?)',
    location:
      'insert into gestion_location (id, userId, bienId, locataireId, type, debut, jourLoyer, loyerHorsCharges, charges, depot, creeLe) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    paiement:
      'insert into gestion_paiement (id, userId, locationId, periode, montant, date, source, creeLe) values (?, ?, ?, ?, ?, ?, ?, ?)',
    bailleur: 'insert into gestion_bailleur (userId, nom, adresse, modifieLe) values (?, ?, ?, ?)',
    document:
      'insert into gestion_document (id, userId, cle, type, numero, locationId, periode, contenu, emisLe) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  } as const;

  /** Une base de G1a (0001 et 0002) avec un compte, un bien loué et un paiement d'octobre. */
  function baseDeG1a(): DatabaseSync {
    const base = new DatabaseSync(':memory:');
    appliquerMigrations(base, 2);
    base.prepare(SQL.compte).run('u1', 'Camille', EMAIL, 1, H, H);
    base.prepare(SQL.bien).run('b1', 'u1', 'T2 Lices', '12 rue des Lices', 'appartement', 1, H, H);
    base.prepare(SQL.locataire).run('t1', 'u1', 'Julie', 'Martin', H);
    base
      .prepare(SQL.location)
      .run('l1', 'u1', 'b1', 't1', 'meublee', '2026-10-01', 5, 65_000, 5_000, 130_000, H);
    base.prepare(SQL.paiement).run('p1', 'u1', 'l1', '2026-10', 30_000, '2026-10-06', 'manuel', H);
    return base;
  }

  it('les paiements de G1a restent identiques ; un second paiement du même mois devient possible', () => {
    const base = baseDeG1a();
    expect(() =>
      base
        .prepare(SQL.paiement)
        .run('p2', 'u1', 'l1', '2026-10', 40_000, '2026-10-20', 'manuel', H),
    ).toThrow(/UNIQUE constraint failed/);
    const avant = base.prepare('select * from gestion_paiement order by id').all();

    appliquerMigrations(base);
    expect(base.prepare('select * from gestion_paiement order by id').all()).toEqual(avant);
    base.prepare(SQL.paiement).run('p2', 'u1', 'l1', '2026-10', 40_000, '2026-10-20', 'manuel', H);
    expect(base.prepare('select count(*) as n from gestion_paiement').get()).toEqual({ n: 2 });
    // Les clés étrangères de la table recréée tiennent toujours.
    expect(() =>
      base
        .prepare(SQL.paiement)
        .run('p3', 'u1', 'inconnue', '2026-10', 1, '2026-10-21', 'manuel', H),
    ).toThrow(/FOREIGN KEY constraint failed/);
  });

  it('tables et index après 0003 (et les suivantes)', () => {
    const base = baseDeG1a();
    appliquerMigrations(base);
    expect(noms(base, 'table')).toEqual([
      'account',
      'gestion_bailleur',
      'gestion_bien',
      'gestion_changement',
      'gestion_colocataire',
      'gestion_document',
      'gestion_locataire',
      'gestion_location',
      'gestion_paiement',
      'gestion_preference',
      'projet',
      'session',
      'user',
      'verification',
    ]);
    expect(noms(base, 'index')).toEqual([
      'account_userId_idx',
      'gestion_bien_userId_idx',
      'gestion_changement_userId_idx',
      'gestion_colocataire_userId_idx',
      'gestion_document_userId_idx',
      'gestion_locataire_userId_idx',
      'gestion_location_bienId_idx',
      'gestion_location_userId_idx',
      'gestion_paiement_location_periode_idx',
      'gestion_paiement_userId_idx',
      'projet_userId_revision_idx',
      'session_userId_idx',
      'verification_identifier_idx',
    ]);
  });

  it('un document est unique par compte et par clé ; bailleur et documents partent avec le compte', () => {
    const base = baseDeG1a();
    appliquerMigrations(base);
    base.prepare(SQL.bailleur).run('u1', 'Pierre Georgel', '3 rue Paradis', H);
    const cle = 'quittance:l1:2026-10';
    base
      .prepare(SQL.document)
      .run('d1', 'u1', cle, 'quittance', 'Q-202610-L1', 'l1', '2026-10', '{}', H);
    expect(() =>
      base
        .prepare(SQL.document)
        .run('d2', 'u1', cle, 'quittance', 'Q-202610-L1', 'l1', '2026-10', '{}', H),
    ).toThrow(/UNIQUE constraint failed/);

    base.prepare('delete from "user" where id = ?').run('u1');
    expect(base.prepare('select count(*) as n from gestion_document').get()).toEqual({ n: 0 });
    expect(base.prepare('select count(*) as n from gestion_bailleur').get()).toEqual({ n: 0 });
    expect(base.prepare('select count(*) as n from gestion_paiement').get()).toEqual({ n: 0 });
  });

  it('plusieurs locataires : un libellé par location, des colocataires uniques, supprimés avec la location', () => {
    const base = baseDeG1a();
    appliquerMigrations(base);
    base.prepare('update gestion_location set libelle = ? where id = ?').run('Chambre 2', 'l1');
    expect(base.prepare('select libelle from gestion_location where id = ?').get('l1')).toEqual({
      libelle: 'Chambre 2',
    });
    base.prepare(SQL.locataire).run('t2', 'u1', 'Léa', 'Bernard', H);
    const colocataire = base.prepare(
      'insert into gestion_colocataire (locationId, locataireId, userId, ordre) values (?, ?, ?, ?)',
    );
    colocataire.run('l1', 't2', 'u1', 1);
    expect(() => colocataire.run('l1', 't2', 'u1', 2)).toThrow(/UNIQUE constraint failed/);
    expect(() => colocataire.run('inconnue', 't2', 'u1', 1)).toThrow(
      /FOREIGN KEY constraint failed/,
    );

    base.prepare('delete from gestion_location where id = ?').run('l1');
    expect(base.prepare('select count(*) as n from gestion_colocataire').get()).toEqual({ n: 0 });
  });

  it('migration 0005 : APL à 0 pour les locations existantes, un changement par mois, supprimé avec la location', () => {
    const base = baseDeG1a();
    appliquerMigrations(base);
    expect(
      base.prepare('select apl, loyerHorsCharges from gestion_location where id = ?').get('l1'),
    ).toEqual({ apl: 0, loyerHorsCharges: 65_000 });
    const changement = base.prepare(
      'insert into gestion_changement (locationId, userId, aPartirDe, loyerHorsCharges, charges, apl, modifieLe) values (?, ?, ?, ?, ?, ?, ?)',
    );
    changement.run('l1', 'u1', '2026-11', 68_000, 5_000, 0, H);
    expect(() => changement.run('l1', 'u1', '2026-11', 69_000, 5_000, 0, H)).toThrow(
      /UNIQUE constraint failed/,
    );
    expect(() => changement.run('inconnue', 'u1', '2026-12', 1, 0, 0, H)).toThrow(
      /FOREIGN KEY constraint failed/,
    );
    base.prepare('delete from gestion_location where id = ?').run('l1');
    expect(base.prepare('select count(*) as n from gestion_changement').get()).toEqual({ n: 0 });
  });
});
