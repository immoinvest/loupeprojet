import type { D1Database } from '@cloudflare/workers-types';
import { ORIGINES_SITE as ORIGINES_DU_SITE } from '@loupe/capture/origines';
import type { BetterAuthOptions } from 'better-auth';
import { z } from 'zod';

import { envoyeurJournal, envoyeurResend, type Envoyeur } from './courriel';
import { ErreurConfiguration } from './erreurs';
import { lireConfigFournisseurs, type ConfigFournisseurs } from './fournisseurs';
import type { DepotArgent } from './gestion/argent/depot';
import { depotArgentD1 } from './gestion/argent/depot-d1';
import type { DepotBail } from './gestion/bail/depot';
import { depotBailD1 } from './gestion/bail/depot-d1';
import type { DepotFinBail } from './gestion/fin-bail/depot';
import { depotFinBailD1 } from './gestion/fin-bail/depot-d1';
import type { DepotGestion } from './gestion/depot';
import { depotD1 } from './gestion/depot-d1';
import type { DepotEnvois } from './gestion/envois/depot';
import { depotEnvoisD1 } from './gestion/envois/depot-d1';
import { signatureJetons, type SignatureJetons } from './gestion/envois/jetons';
import { journalConsole, type Journal } from './journal';
import type { DepotPartages } from './partage/depot';
import { depotPartagesD1 } from './partage/depot-d1';
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
  readonly JETON_COURRIEL_SECRET?: string | undefined;
}

export interface Dependances {
  readonly environnement: Environnement;
  /** Secret de Better Auth (cookies, jetons) : BETTER_AUTH_SECRET, ou une valeur fixe en dev. */
  readonly secret: string;
  /** La base des comptes : le binding D1 en production, un adaptateur mémoire en test. */
  readonly base: BetterAuthOptions['database'];
  /** Les données de gestion locative : les tables gestion_* de la même base D1. */
  readonly gestion: DepotGestion;
  /** Dépenses et prêts des biens gérés : les tables de la migration 0007, lues par leurs seules routes. */
  readonly argent: DepotArgent;
  /** DPE, révision et lettres (vie du bail) : les tables de la migration 0008 de la même base D1. */
  readonly bail: DepotBail;
  /** Congé, dépôt, régularisation, colocataires (fin du bail) : les tables de la migration 0011. */
  readonly finBail: DepotFinBail;
  /** Les projets d'analyse synchronisés : la table projet de la même base D1. */
  readonly projets: DepotProjets;
  /** Les liens de partage courts, sans compte : la table partage de la même base D1 (ADR-009). */
  readonly partages: DepotPartages;
  /** Accords, traces d'envoi, téléphones, identités par bien : tables de la migration 0009. */
  readonly envois: DepotEnvois;
  /** Signature des liens d'accord : JETON_COURRIEL_SECRET, un secret fixe en dev, sinon null (aucune invitation). */
  readonly jetons: SignatureJetons | null;
  /** L'attente avant l'envoi d'une quittance (ADR-G43) ; immédiate en test. */
  readonly attendre: (ms: number) => Promise<void>;
  /** Envoi des codes et des e-mails de Gérer : Resend avec une clé, le journal en dev, sinon null. */
  readonly courriel: Envoyeur | null;
  readonly fournisseurs: ConfigFournisseurs;
  /** Origines connues : le site et ses previews, localhost en dev, plus ORIGINES_AUTORISEES. */
  readonly origines: readonly string[];
  readonly journal: Journal;
  readonly maintenant: () => number;
}

/** Secret de développement : jamais hors dev (le worker refuse de démarrer sans BETTER_AUTH_SECRET). */
export const SECRET_DEV = 'deklic-dev-secret-ne-jamais-utiliser-en-production';

/** Clé des liens d'accord en dev : jamais hors dev (sans JETON_COURRIEL_SECRET, aucune invitation). */
export const SECRET_JETONS_DEV = 'deklic-dev-jetons-ne-jamais-utiliser-en-production';

export function attendreVraiment(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Le site : l'adresse historique, app.deklic.pro (prête avant la bascule) et les previews
 * (https://<branche ou empreinte>.loupeprojet.pages.dev).
 */
export const ORIGINES_SITE: readonly string[] = ORIGINES_DU_SITE;

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
  JETON_COURRIEL_SECRET: z.string().min(32).optional(),
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

function lireJetons(v: Variables): SignatureJetons | null {
  if (v.JETON_COURRIEL_SECRET !== undefined) return signatureJetons(v.JETON_COURRIEL_SECRET);
  return v.ENVIRONNEMENT === 'dev' ? signatureJetons(SECRET_JETONS_DEV) : null;
}

/** Construit les dépendances de production à partir de l'environnement Cloudflare. */
export function dependancesDepuisEnv(env: Bindings): Dependances {
  const v = lireVariables(env);
  const locales = v.ENVIRONNEMENT === 'dev' ? ORIGINES_DEV : [];
  const base = lireBase(env);
  const secret = lireSecret(v);
  return {
    environnement: v.ENVIRONNEMENT,
    secret,
    base,
    gestion: depotD1(base),
    argent: depotArgentD1(base),
    bail: depotBailD1(base),
    finBail: depotFinBailD1(base),
    projets: depotProjetsD1(base),
    partages: depotPartagesD1(base, secret),
    envois: depotEnvoisD1(base),
    jetons: lireJetons(v),
    attendre: attendreVraiment,
    courriel: lireCourriel(v, journalConsole),
    fournisseurs: lireConfigFournisseurs(v),
    origines: [...ORIGINES_SITE, ...locales, ...lireOriginesSupplementaires(v.ORIGINES_AUTORISEES)],
    journal: journalConsole,
    maintenant: () => Date.now(),
  };
}
