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
    appliquerMigrations(base);
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
    expect(MIGRATIONS.map((m) => m.fichier)).toEqual(['0001_comptes.sql', '0002_gestion.sql']);
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
