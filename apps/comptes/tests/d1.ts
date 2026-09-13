import type { D1Database } from '@cloudflare/workers-types';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';

/**
 * Une base D1 simulée au-dessus de node:sqlite (D1 est du SQLite). Better Auth la reconnaît comme D1
 * (prepare, batch, exec) et passe par son dialecte D1, sans transaction. Les valeurs sont contrôlées
 * comme dans D1 : null, nombre, texte, booléen (0/1), ArrayBuffer ; une date ou un objet est refusé.
 * (Miniflare ne démarre pas sur toutes les machines de développement : ce double tourne partout.)
 */
function valeurD1(valeur: unknown): SQLInputValue {
  if (valeur === null || typeof valeur === 'number' || typeof valeur === 'string') return valeur;
  if (typeof valeur === 'boolean') return valeur ? 1 : 0;
  if (valeur instanceof ArrayBuffer) return new Uint8Array(valeur);
  const description = valeur instanceof Date ? 'Date' : typeof valeur;
  throw new TypeError(`D1_TYPE_ERROR: Type '${description}' not supported`);
}

interface ResultatD1 {
  readonly results: Record<string, unknown>[];
  readonly success: true;
  readonly meta: { readonly changes: number; readonly last_row_id: number; readonly duration: 0 };
}

class InstructionD1 {
  constructor(
    private readonly base: DatabaseSync,
    private readonly journal: string[],
    private readonly sql: string,
    private readonly valeurs: readonly SQLInputValue[] = [],
  ) {}

  bind(...valeurs: unknown[]): InstructionD1 {
    return new InstructionD1(this.base, this.journal, this.sql, valeurs.map(valeurD1));
  }

  all(): Promise<ResultatD1> {
    this.journal.push(this.sql);
    const lignes = this.base.prepare(this.sql).all(...this.valeurs);
    const effet = this.base.prepare('select changes() as c, last_insert_rowid() as r').get();
    return Promise.resolve({
      results: lignes,
      success: true,
      meta: { changes: Number(effet?.c ?? 0), last_row_id: Number(effet?.r ?? 0), duration: 0 },
    });
  }

  run(): Promise<ResultatD1> {
    return this.all();
  }

  async first(colonne?: string): Promise<unknown> {
    const { results } = await this.all();
    const ligne = results[0];
    if (ligne === undefined) return null;
    return colonne === undefined ? ligne : ligne[colonne];
  }
}

export interface D1Simulee {
  readonly base: D1Database;
  /** Chaque requête SQL passée par l'interface D1, dans l'ordre. */
  readonly requetes: string[];
}

export function d1SurSqlite(base: DatabaseSync): D1Simulee {
  const requetes: string[] = [];
  const d1 = {
    prepare: (sql: string) => new InstructionD1(base, requetes, sql),
    batch: async (instructions: InstructionD1[]) => {
      const resultats: ResultatD1[] = [];
      for (const instruction of instructions) resultats.push(await instruction.all());
      return resultats;
    },
    exec: (sql: string) => {
      base.exec(sql);
      return Promise.resolve({ count: 1, duration: 0 });
    },
  };
  return { base: d1 as unknown as D1Database, requetes };
}
