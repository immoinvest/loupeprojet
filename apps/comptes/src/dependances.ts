import { z } from 'zod';

import { ErreurConfiguration } from './erreurs';
import { lireConfigFournisseurs, type ConfigFournisseurs } from './fournisseurs';
import { journalConsole, type Journal } from './journal';

export type Environnement = 'dev' | 'preview' | 'production';

/** Les fichiers statiques du site, fournis par Cloudflare Pages au worker (absents en `wrangler dev`). */
export interface ServeurStatique {
  fetch(requete: Request): Promise<Response>;
}

/** Ce que Cloudflare injecte : bindings (wrangler.toml, projet Pages) et variables (vars, secrets, .dev.vars). */
export interface Bindings {
  readonly DB: D1Database;
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
  readonly fournisseurs: ConfigFournisseurs;
  /** Origines de confiance : production, previews Pages, localhost, plus ORIGINES_AUTORISEES. */
  readonly origines: readonly string[];
  readonly journal: Journal;
  readonly maintenant: () => number;
}

/** Secret de développement : jamais en production (le worker refuse de démarrer sans BETTER_AUTH_SECRET). */
export const SECRET_DEV = 'deklic-dev-secret-ne-jamais-utiliser-en-production';

export const ORIGINES_DEFAUT: readonly string[] = [
  'https://loupeprojet.pages.dev',
  'https://*.loupeprojet.pages.dev',
  'http://localhost:5173',
  'http://localhost:8787',
];

const Optionnelle = z.string().trim().min(1).optional();

const VariablesSchema = z.object({
  ENVIRONNEMENT: z.enum(['dev', 'preview', 'production']).default('dev'),
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

/** Construit les dépendances de production à partir de l'environnement Cloudflare. */
export function dependancesDepuisEnv(env: Bindings): Dependances {
  const v = lireVariables(env);
  return {
    environnement: v.ENVIRONNEMENT,
    secret: lireSecret(v),
    fournisseurs: lireConfigFournisseurs(v),
    origines: [...ORIGINES_DEFAUT, ...lireOriginesSupplementaires(v.ORIGINES_AUTORISEES)],
    journal: journalConsole,
    maintenant: () => Date.now(),
  };
}
