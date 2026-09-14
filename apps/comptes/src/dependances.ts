import type { D1Database } from '@cloudflare/workers-types';
import type { BetterAuthOptions } from 'better-auth';
import { z } from 'zod';

import { envoyeurJournal, envoyeurResend, type Envoyeur } from './courriel';
import { ErreurConfiguration } from './erreurs';
import { lireConfigFournisseurs, type ConfigFournisseurs } from './fournisseurs';
import type { DepotGestion } from './gestion/depot';
import { depotD1 } from './gestion/depot-d1';
import { journalConsole, type Journal } from './journal';
import type { DepotProjets } from './projets/depot';
import { depotProjetsD1 } from './projets/depot-d1';

export type Environnement = 'dev' | 'preview' | 'production';

/** Les fichiers statiques du site, fournis par Cloudflare Pages au worker (absents en `wrangler dev`). */
export interface ServeurStatique {
  fetch(requete: Request): Promise<Response>;
}

/** Ce que Cloudflare injecte : bindings (projet Pages, wrangler.toml) et variables (vars, secrets, .dev.vars). */
export interface Bindings {
  readonly DB?: D1Database | undefined;
  readonly ASSETS?: ServeurStatique | undefined;
  readonly ENVIRONNEMENT?: string | undefined;
  readonly BETTER_AUTH_SECRET?: string | undefined;
  readonly RESEND_API_KEY?: string | undefined;
  readonly COURRIEL_EXPEDITEUR?: string | undefined;
  readonly GOOGLE_CLIENT_ID?: string | undefined;
  readonly GOOGLE_CLIENT_SECRET?: string | undefined;
  readonly APPLE_CLIENT_ID?: string | undefined;
  readonly APPLE_TEAM_ID?: string | undefined;
  readonly APPLE_KEY_ID?: string | undefined;
  readonly APPLE_PRIVATE_KEY?: string | undefined;
  readonly ORIGINES_AUTORISEES?: string | undefined;
}

export interface Dependances {
  readonly environnement: Environnement;
  /** Secret de Better Auth (cookies, jetons) : BETTER_AUTH_SECRET, ou une valeur fixe en dev. */
  readonly secret: string;
  /** La base des comptes : le binding D1 en production, un adaptateur mémoire en test. */
  readonly base: BetterAuthOptions['database'];
  /** Les données de gestion locative : les tables gestion_* de la même base D1. */
  readonly gestion: DepotGestion;
  /** Les projets d'analyse synchronisés : la table projet de la même base D1. */
  readonly projets: DepotProjets;
  /** Envoi des codes : Resend avec une clé, le journal en dev, sinon null (l'e-mail n'est pas proposé). */
  readonly courriel: Envoyeur | null;
  readonly fournisseurs: ConfigFournisseurs;
  /** Origines connues : le site et ses previews, localhost en dev, plus ORIGINES_AUTORISEES. */
  readonly origines: readonly string[];
  readonly journal: Journal;
  readonly maintenant: () => number;
}

/** Secret de développement : jamais hors dev (le worker refuse de démarrer sans BETTER_AUTH_SECRET). */
export const SECRET_DEV = 'deklic-dev-secret-ne-jamais-utiliser-en-production';

/** Le site en production et ses previews (https://<branche ou empreinte>.loupeprojet.pages.dev). */
export const ORIGINES_SITE: readonly string[] = [
  'https://loupeprojet.pages.dev',
  'https://*.loupeprojet.pages.dev',
];

/** Le poste de développement : Vite (5173) et wrangler dev (8787). */
export const ORIGINES_DEV: readonly string[] = ['http://localhost:5173', 'http://localhost:8787'];

const Optionnelle = z.string().trim().min(1).optional();

const VariablesSchema = z.object({
  // Sans variable, on suppose la production : secret exigé, aucune origine locale (échec fermé).
  ENVIRONNEMENT: z.enum(['dev', 'preview', 'production']).default('production'),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  RESEND_API_KEY: Optionnelle,
  COURRIEL_EXPEDITEUR: z.string().trim().min(3).default('Deklic <onboarding@resend.dev>'),
  GOOGLE_CLIENT_ID: Optionnelle,
  GOOGLE_CLIENT_SECRET: Optionnelle,
  APPLE_CLIENT_ID: Optionnelle,
  APPLE_TEAM_ID: Optionnelle,
  APPLE_KEY_ID: Optionnelle,
  APPLE_PRIVATE_KEY: Optionnelle,
  ORIGINES_AUTORISEES: Optionnelle,
});

export type Variables = z.infer<typeof VariablesSchema>;

const NOMS_VARIABLES = Object.keys(VariablesSchema.shape) as (keyof Variables)[];

/** Lit et valide les variables ; une variable vide (`X=` dans .dev.vars) vaut « absente ». */
export function lireVariables(env: Bindings): Variables {
  const brut: Record<string, string | undefined> = {};
  for (const nom of NOMS_VARIABLES) {
    const valeur = env[nom];
    brut[nom] = valeur === undefined || valeur.trim() === '' ? undefined : valeur;
  }
  const resultat = VariablesSchema.safeParse(brut);
  if (!resultat.success) {
    throw new ErreurConfiguration(
      resultat.error.issues
        .map((i) => `${i.path.map(String).join('.')} : ${i.message}`)
        .join(' ; '),
    );
  }
  return resultat.data;
}

/** « a, b ,c » → ['a', 'b', 'c'] ; les vides sont ignorés. */
export function lireOriginesSupplementaires(texte: string | undefined): string[] {
  if (texte === undefined) return [];
  return texte
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o !== '');
}

function lireSecret(v: Variables): string {
  if (v.BETTER_AUTH_SECRET !== undefined) return v.BETTER_AUTH_SECRET;
  if (v.ENVIRONNEMENT === 'dev') return SECRET_DEV;
  throw new ErreurConfiguration('BETTER_AUTH_SECRET manquant (obligatoire hors dev)');
}

function lireBase(env: Bindings): D1Database {
  if (env.DB === undefined) throw new ErreurConfiguration('binding D1 « DB » absent');
  return env.DB;
}

function lireCourriel(v: Variables, journal: Journal): Envoyeur | null {
  if (v.RESEND_API_KEY !== undefined) {
    return envoyeurResend(v.RESEND_API_KEY, v.COURRIEL_EXPEDITEUR);
  }
  return v.ENVIRONNEMENT === 'dev' ? envoyeurJournal(journal) : null;
}

/** Construit les dépendances de production à partir de l'environnement Cloudflare. */
export function dependancesDepuisEnv(env: Bindings): Dependances {
  const v = lireVariables(env);
  const locales = v.ENVIRONNEMENT === 'dev' ? ORIGINES_DEV : [];
  const base = lireBase(env);
  return {
    environnement: v.ENVIRONNEMENT,
    secret: lireSecret(v),
    base,
    gestion: depotD1(base),
    projets: depotProjetsD1(base),
    courriel: lireCourriel(v, journalConsole),
    fournisseurs: lireConfigFournisseurs(v),
    origines: [...ORIGINES_SITE, ...locales, ...lireOriginesSupplementaires(v.ORIGINES_AUTORISEES)],
    journal: journalConsole,
    maintenant: () => Date.now(),
  };
}
