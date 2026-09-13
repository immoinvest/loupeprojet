import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { getMigrations } from 'better-auth/db/migration';

import { optionsAuth } from '../src/auth';
import type { Dependances } from '../src/dependances';
import { journalMemoire } from '../src/journal';

/** La migration versionnée, appliquée par `wrangler d1 migrations apply`. */
export const FICHIER_MIGRATION = new URL('../migrations/0001_comptes.sql', import.meta.url);

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
