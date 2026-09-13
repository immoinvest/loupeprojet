import { z } from 'zod';

import { lireOriginesSupplementaires, ORIGINES_DEFAUT } from './cors';
import { ErreurConfiguration } from './erreurs';
import { journalConsole, type Journal } from './journal';
import { cacheKv, type Cache, type KvMinimal } from './proxy/cache';
import type { LimiteurDebit } from './proxy/debit';
import { SERVICES, type Service } from './services';

export type Environnement = 'dev' | 'preview' | 'production';

/** Ce que Cloudflare injecte : bindings (wrangler.toml) et variables (vars / .dev.vars). */
export interface Bindings {
  readonly KV_CACHE: KvMinimal;
  readonly LIMITEUR: LimiteurDebit;
  readonly ENVIRONNEMENT?: string | undefined;
  readonly ORIGINES_AUTORISEES?: string | undefined;
}

export type Fetcher = (
  url: URL,
  init: { readonly signal: AbortSignal; readonly headers: Readonly<Record<string, string>> },
) => Promise<Response>;

export interface Dependances {
  readonly environnement: Environnement;
  readonly origines: readonly string[];
  readonly services: Readonly<Record<string, Service>>;
  readonly cache: Cache;
  readonly limiteur: LimiteurDebit;
  readonly fetcher: Fetcher;
  readonly maintenant: () => number;
  readonly journal: Journal;
}

const VariablesSchema = z.object({
  ENVIRONNEMENT: z.enum(['dev', 'preview', 'production']).default('dev'),
  ORIGINES_AUTORISEES: z.string().optional(),
});

/** Construit les dépendances de production à partir de l'environnement Cloudflare. */
export function dependancesDepuisEnv(env: Bindings): Dependances {
  const variables = VariablesSchema.safeParse({
    ENVIRONNEMENT: env.ENVIRONNEMENT,
    ORIGINES_AUTORISEES: env.ORIGINES_AUTORISEES,
  });
  if (!variables.success) {
    throw new ErreurConfiguration(
      variables.error.issues
        .map((i) => `${i.path.map(String).join('.')} : ${i.message}`)
        .join(' ; '),
    );
  }
  return {
    environnement: variables.data.ENVIRONNEMENT,
    origines: [
      ...ORIGINES_DEFAUT,
      ...lireOriginesSupplementaires(variables.data.ORIGINES_AUTORISEES),
    ],
    services: SERVICES,
    cache: cacheKv(env.KV_CACHE),
    limiteur: env.LIMITEUR,
    fetcher: (url, init) => fetch(url, init),
    maintenant: () => Date.now(),
    journal: journalConsole,
  };
}
