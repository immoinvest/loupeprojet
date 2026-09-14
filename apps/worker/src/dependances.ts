import { z } from 'zod';

import { lireOriginesSupplementaires, ORIGINES_DEFAUT } from './cors';
import { lecteurR2, type LecteurDonnees, type R2Minimal } from './donnees/lecteur';
import { ErreurConfiguration } from './erreurs';
import {
  DELAI_LLM_MS,
  extracteurChat,
  MODELE_DEFAUT,
  URL_OPENROUTER,
  type Extracteur,
} from './extraction';
import { journalConsole, type Journal } from './journal';
import {
  DELAI_PAGE_MS,
  lecteurBrightData,
  ZONE_DEFAUT,
  type LecteurPages,
} from './lecture/fournisseur';
import { cacheKv, type Cache, type KvMinimal } from './proxy/cache';
import type { LimiteurDebit } from './proxy/debit';
import { SERVICES, type Service } from './services';

export type Environnement = 'dev' | 'preview' | 'production';

/** Ce que Cloudflare injecte : bindings (wrangler.toml), variables (vars / .dev.vars) et secrets. */
export interface Bindings {
  readonly KV_CACHE: KvMinimal;
  readonly LIMITEUR: LimiteurDebit;
  readonly LIMITEUR_EXTRACTION: LimiteurDebit;
  readonly LIMITEUR_LECTURE: LimiteurDebit;
  /** Bucket R2 `deklic-data` (juridiction UE) : référentiels publiés par `data/`. */
  readonly DONNEES: R2Minimal;
  readonly ENVIRONNEMENT?: string | undefined;
  readonly ORIGINES_AUTORISEES?: string | undefined;
  readonly LLM_URL?: string | undefined;
  readonly LLM_MODELE?: string | undefined;
  /** Secret (`wrangler secret put`) : sans lui, /extract répond EXTRACTION_INDISPONIBLE. */
  readonly OPENROUTER_API_KEY?: string | undefined;
  /** Secret : sans lui, /lecture ne lit que Bien'ici (LECTURE_INDISPONIBLE pour les quatre autres portails). */
  readonly BRIGHTDATA_API_KEY?: string | undefined;
  /** Zone « Web Unlocker » du compte Bright Data. */
  readonly BRIGHTDATA_ZONE?: string | undefined;
}

export type Fetcher = (
  url: URL,
  init: {
    readonly method?: 'GET' | 'POST';
    readonly signal: AbortSignal;
    readonly headers: Readonly<Record<string, string>>;
    readonly body?: string;
  },
) => Promise<Response>;

export interface Dependances {
  readonly environnement: Environnement;
  readonly origines: readonly string[];
  readonly services: Readonly<Record<string, Service>>;
  readonly cache: Cache;
  readonly limiteur: LimiteurDebit;
  readonly limiteurExtraction: LimiteurDebit;
  readonly limiteurLecture: LimiteurDebit;
  readonly extracteur: Extracteur | null;
  /** `null` sans clé Bright Data : seules les annonces Bien'ici se lisent. */
  readonly lecteurPages: LecteurPages | null;
  readonly donnees: LecteurDonnees;
  readonly fetcher: Fetcher;
  readonly maintenant: () => number;
  readonly journal: Journal;
}

const VariablesSchema = z.object({
  ENVIRONNEMENT: z.enum(['dev', 'preview', 'production']).default('dev'),
  ORIGINES_AUTORISEES: z.string().optional(),
  LLM_URL: z.url().default(URL_OPENROUTER),
  LLM_MODELE: z.string().trim().min(1).default(MODELE_DEFAUT),
  OPENROUTER_API_KEY: z.string().trim().optional(),
  BRIGHTDATA_API_KEY: z.string().trim().optional(),
  BRIGHTDATA_ZONE: z
    .string()
    .regex(/^[\w-]{1,64}$/)
    .default(ZONE_DEFAUT),
});

/** Construit les dépendances de production à partir de l'environnement Cloudflare. */
export function dependancesDepuisEnv(env: Bindings): Dependances {
  const variables = VariablesSchema.safeParse({
    ENVIRONNEMENT: env.ENVIRONNEMENT,
    ORIGINES_AUTORISEES: env.ORIGINES_AUTORISEES,
    LLM_URL: env.LLM_URL,
    LLM_MODELE: env.LLM_MODELE,
    OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
    BRIGHTDATA_API_KEY: env.BRIGHTDATA_API_KEY,
    BRIGHTDATA_ZONE: env.BRIGHTDATA_ZONE,
  });
  if (!variables.success) {
    throw new ErreurConfiguration(
      variables.error.issues
        .map((i) => `${i.path.map(String).join('.')} : ${i.message}`)
        .join(' ; '),
    );
  }
  const fetcher: Fetcher = (url, init) => fetch(url, init);
  const cle = variables.data.OPENROUTER_API_KEY;
  const extracteur =
    cle === undefined || cle === ''
      ? null
      : extracteurChat(
          {
            url: variables.data.LLM_URL,
            modele: variables.data.LLM_MODELE,
            cle,
            delaiMs: DELAI_LLM_MS,
          },
          fetcher,
          journalConsole,
        );
  const cleLecture = variables.data.BRIGHTDATA_API_KEY;
  const lecteurPages =
    cleLecture === undefined || cleLecture === ''
      ? null
      : lecteurBrightData(
          { cle: cleLecture, zone: variables.data.BRIGHTDATA_ZONE, delaiMs: DELAI_PAGE_MS },
          fetcher,
          journalConsole,
        );
  return {
    environnement: variables.data.ENVIRONNEMENT,
    origines: [
      ...ORIGINES_DEFAUT,
      ...lireOriginesSupplementaires(variables.data.ORIGINES_AUTORISEES),
    ],
    services: SERVICES,
    cache: cacheKv(env.KV_CACHE),
    limiteur: env.LIMITEUR,
    limiteurExtraction: env.LIMITEUR_EXTRACTION,
    limiteurLecture: env.LIMITEUR_LECTURE,
    extracteur,
    lecteurPages,
    donnees: lecteurR2(env.DONNEES),
    fetcher,
    maintenant: () => Date.now(),
    journal: journalConsole,
  };
}
