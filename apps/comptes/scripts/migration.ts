import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { getMigrations } from 'better-auth/db/migration';

import { optionsAuth } from '../src/auth';
import type { Dependances } from '../src/dependances';
import { depotArgentD1 } from '../src/gestion/argent/depot-d1';
import { depotBailD1 } from '../src/gestion/bail/depot-d1';
import { depotFinBailD1 } from '../src/gestion/fin-bail/depot-d1';
import { depotD1 } from '../src/gestion/depot-d1';
import { depotEnvoisD1 } from '../src/gestion/envois/depot-d1';
import { journalMemoire } from '../src/journal';
import { depotPartagesD1 } from '../src/partage/depot-d1';
import { depotProjetsD1 } from '../src/projets/depot-d1';
import { d1SurSqlite } from './d1-sqlite';

/** La migration des comptes, générée depuis la configuration de Better Auth. */
export const FICHIER_MIGRATION = new URL('../migrations/0001_comptes.sql', import.meta.url);

/**
 * Toutes les migrations, dans l'ordre où `wrangler d1 migrations apply` les applique, chacune avec une
 * table qu'elle crée (pour savoir, hors wrangler, si elle est déjà passée).
 */
export const MIGRATIONS: readonly { readonly fichier: string; readonly table: string }[] = [
  { fichier: '0001_comptes.sql', table: 'user' },
  { fichier: '0002_gestion.sql', table: 'gestion_bien' },
  { fichier: '0003_gestion_documents.sql', table: 'gestion_document' },
  { fichier: '0004_projets.sql', table: 'projet' },
  { fichier: '0005_gestion_changements.sql', table: 'gestion_changement' },
  { fichier: '0006_partage.sql', table: 'partage' },
  { fichier: '0007_gestion_depenses.sql', table: 'gestion_depense' },
  { fichier: '0008_gestion_bail.sql', table: 'gestion_bien_legal' },
  { fichier: '0009_gestion_envois.sql', table: 'gestion_envoi' },
  { fichier: '0011_gestion_fin_bail.sql', table: 'gestion_conge' },
];

export function lireMigrationNommee(fichier: string): string {
  return readFileSync(new URL(`../migrations/${fichier}`, import.meta.url), 'utf8');
}

/** Applique les `nombre` premières migrations qui manquent (toutes par défaut) sur une base SQLite. */
export function appliquerMigrations(base: DatabaseSync, nombre = MIGRATIONS.length): void {
  for (const { fichier, table } of MIGRATIONS.slice(0, nombre)) {
    const existe = base
      .prepare("select count(*) as n from sqlite_master where type = 'table' and name = ?")
      .get(table);
    if (Number(existe?.n ?? 0) === 0) base.exec(lireMigrationNommee(fichier));
  }
}

export const ENTETE_MIGRATION = [
  '-- Comptes Deklic : tables de Better Auth (utilisateurs, sessions, comptes liés, codes de vérification).',
  '-- Généré par `npm run migration:generer -w apps/comptes` depuis src/auth.ts : ne pas modifier à la main.',
  '-- Appliquer depuis apps/comptes : `npx wrangler d1 migrations apply deklic-comptes --remote` (--local en dev).',
].join('\n');

/** Le SQL que Better Auth attend pour notre configuration, compilé sur une base SQLite vide (dialecte de D1). */
export async function compilerMigration(): Promise<string> {
  const deps: Dependances = {
    environnement: 'dev',
    secret: 'generation-de-migration-sans-secret-reel-000',
    base: new DatabaseSync(':memory:'),
    gestion: depotD1(d1SurSqlite(new DatabaseSync(':memory:')).base),
    argent: depotArgentD1(d1SurSqlite(new DatabaseSync(':memory:')).base),
    bail: depotBailD1(d1SurSqlite(new DatabaseSync(':memory:')).base),
    finBail: depotFinBailD1(d1SurSqlite(new DatabaseSync(':memory:')).base),
    projets: depotProjetsD1(d1SurSqlite(new DatabaseSync(':memory:')).base),
    partages: depotPartagesD1(d1SurSqlite(new DatabaseSync(':memory:')).base, ''),
    envois: depotEnvoisD1(d1SurSqlite(new DatabaseSync(':memory:')).base),
    jetons: null,
    attendre: () => Promise.resolve(),
    courriel: null,
    fournisseurs: {},
    origines: [],
    journal: journalMemoire(),
    maintenant: () => 0,
  };
  const { compileMigrations } = await getMigrations(optionsAuth(deps, 'http://localhost:8787'));
  return compileMigrations();
}

export function contenuMigration(sql: string): string {
  return `${ENTETE_MIGRATION}\n\n${sql.trim()}\n`;
}

export function lireMigration(): string {
  return readFileSync(FICHIER_MIGRATION, 'utf8');
}
