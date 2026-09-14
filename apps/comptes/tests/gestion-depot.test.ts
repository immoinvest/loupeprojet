import type { D1Database } from '@cloudflare/workers-types';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { d1SurSqlite } from '../scripts/d1-sqlite';
import { appliquerMigrations } from '../scripts/migration';
import { ErreurGestion, estDoublon, estTableAbsente } from '../src/gestion/depot';
import { depotD1 } from '../src/gestion/depot-d1';
import { valeurSql, versBien, versPreferences } from '../src/gestion/lignes';
import { compter } from './aide';

const HORODATAGE = '2026-09-14T09:00:00.000Z';

/** Une base migrée avec le compte « u1 » (les tables de gestion exigent un utilisateur existant). */
function baseAvecCompte(): DatabaseSync {
  const sqlite = new DatabaseSync(':memory:');
  appliquerMigrations(sqlite);
  sqlite
    .prepare(
      'insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, ?, ?, ?, ?, ?)',
    )
    .run('u1', 'Camille', 'camille@example.org', 1, HORODATAGE, HORODATAGE);
  return sqlite;
}

const LIGNE_BIEN = {
  id: 'b1',
  userId: 'u1',
  nom: 'T2 Lices',
  adresse: '12 rue des Lices',
  codePostal: null,
  ville: null,
  type: 'appartement',
  surface: null,
  meuble: 0,
  projetId: null,
  projet: null,
  creeLe: HORODATAGE,
  modifieLe: HORODATAGE,
};

describe('lignes SQL ↔ objets', () => {
  it('valeurSql : undefined devient NULL, un booléen 0 ou 1', () => {
    expect(valeurSql(undefined)).toBeNull();
    expect(valeurSql(true)).toBe(1);
    expect(valeurSql(false)).toBe(0);
    expect(valeurSql('13005')).toBe('13005');
    expect(valeurSql(38.5)).toBe(38.5);
  });

  it('versBien : les colonnes NULL deviennent des champs absents, 0/1 un booléen', () => {
    expect(versBien(LIGNE_BIEN)).toEqual({
      id: 'b1',
      nom: 'T2 Lices',
      adresse: '12 rue des Lices',
      type: 'appartement',
      meuble: false,
      creeLe: HORODATAGE,
      modifieLe: HORODATAGE,
    });
  });

  it('versBien : un instantané de projet abîmé ou qui n’est pas un objet est ignoré', () => {
    for (const projet of ['{"id": ', '42', '[1, 2]', 'null']) {
      expect(versBien({ ...LIGNE_BIEN, projet }).projet).toBeUndefined();
    }
    expect(versBien({ ...LIGNE_BIEN, meuble: 1, projet: '{"id":"p1"}' })).toMatchObject({
      meuble: true,
      projet: { id: 'p1' },
    });
  });

  it('versPreferences : sans ligne, les deux sections ; sinon les colonnes 0/1', () => {
    expect(versPreferences(undefined)).toEqual({ analyser: true, gerer: true });
    expect(versPreferences({ analyser: 0, gerer: 1 })).toEqual({ analyser: false, gerer: true });
  });
});

describe('erreurs du dépôt', () => {
  it('reconnaît une table absente et un doublon, pas le reste', () => {
    expect(estTableAbsente(new Error('D1_ERROR: no such table: gestion_bien: SQLITE_ERROR'))).toBe(
      true,
    );
    expect(estTableAbsente(new Error('no such table: user'))).toBe(false);
    expect(estTableAbsente('no such table: gestion_bien')).toBe(false);
    expect(estDoublon(new Error('UNIQUE constraint failed: gestion_paiement.locationId'))).toBe(
      true,
    );
    expect(estDoublon(undefined)).toBe(false);
    const erreur = new ErreurGestion('INTROUVABLE');
    expect(erreur).toMatchObject({
      name: 'ErreurGestion',
      code: 'INTROUVABLE',
      message: 'INTROUVABLE',
    });
  });
});

describe('depotD1', () => {
  it('identifiants et horodatages réels par défaut', async () => {
    const sqlite = baseAvecCompte();
    const depot = depotD1(d1SurSqlite(sqlite).base);
    const { bien } = await depot.creer('u1', {
      bien: { nom: 'Studio Baille', adresse: '8 boulevard Baille', type: 'studio', meuble: true },
      locataire: null,
      location: null,
    });
    expect(bien.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number.isNaN(Date.parse(bien.creeLe))).toBe(false);
  });

  it('un appel direct incohérent (locataire sans location) crée un bien vacant', async () => {
    const sqlite = baseAvecCompte();
    let n = 0;
    const depot = depotD1(d1SurSqlite(sqlite).base, {
      maintenant: () => HORODATAGE,
      genererId: () => `id-${String((n += 1))}`,
    });
    const reponse = await depot.creer('u1', {
      bien: { nom: 'T2 Lices', adresse: '12 rue des Lices', type: 'appartement', meuble: true },
      locataire: { prenom: 'Julie', nom: 'Martin' },
      location: null,
    });
    expect(reponse).toMatchObject({ bien: { id: 'id-1' }, locataire: null, location: null });
    expect(compter(sqlite, 'gestion_locataire')).toBe(0);
  });

  it('la création est atomique : si une écriture échoue, aucune n’est gardée', async () => {
    const sqlite = baseAvecCompte();
    sqlite
      .prepare(
        'insert into gestion_locataire (id, userId, prenom, nom, creeLe) values (?, ?, ?, ?, ?)',
      )
      .run('fixe', 'u1', 'Léa', 'Bernard', HORODATAGE);
    // Le bien passe, le locataire heurte la clé primaire existante.
    const depot = depotD1(d1SurSqlite(sqlite).base, { genererId: () => 'fixe' });
    await expect(
      depot.creer('u1', {
        bien: { nom: 'Coloc Rouet', adresse: '3 rue du Rouet', type: 'appartement', meuble: true },
        locataire: { prenom: 'Hugo', nom: 'Petit' },
        location: {
          type: 'meublee',
          debut: '2026-09-01',
          jourLoyer: 1,
          loyerHorsCharges: 45_000,
          charges: 4_000,
          depot: 90_000,
        },
      }),
    ).rejects.toThrow(/UNIQUE constraint failed/);
    expect(compter(sqlite, 'gestion_bien')).toBe(0);
  });

  it('une panne à l’écriture d’un paiement remonte telle quelle', async () => {
    const sqlite = baseAvecCompte();
    const d1 = d1SurSqlite(sqlite).base;
    const depot = depotD1(d1);
    const { location } = await depot.creer('u1', {
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
    });
    // Seules les lectures et l'écriture d'un paiement passent par `prepare` dans `payer`.
    const enPanne = {
      prepare: (sql: string) =>
        sql.startsWith('insert into gestion_paiement')
          ? { bind: () => ({ run: () => Promise.reject(new Error('disque plein')) }) }
          : d1.prepare(sql),
    } as unknown as D1Database;
    await expect(
      depotD1(enPanne).payer('u1', {
        locationId: location?.id ?? '',
        periode: '2026-10',
        montant: 70_000,
        date: '2026-10-05',
      }),
    ).rejects.toThrow('disque plein');
  });
});
