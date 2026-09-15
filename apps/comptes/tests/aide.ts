import { ORIGINES_SITE } from '@loupe/capture/origines';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { DatabaseSync } from 'node:sqlite';

import { d1SurSqlite } from '../scripts/d1-sqlite';
import { appliquerMigrations } from '../scripts/migration';
import { creerApp } from '../src/app';
import type { Envoyeur, Message } from '../src/courriel';
import type { Dependances } from '../src/dependances';
import { depotArgentD1, type OptionsDepotArgent } from '../src/gestion/argent/depot-d1';
import { depotBailD1 } from '../src/gestion/bail/depot-d1';
import { depotD1, type OptionsDepot } from '../src/gestion/depot-d1';
import { journalMemoire } from '../src/journal';
import { depotPartagesD1, type OptionsDepotPartages } from '../src/partage/depot-d1';
import { depotProjetsD1, type OptionsDepotProjets } from '../src/projets/depot-d1';

export const ORIGINE = 'http://localhost:5173';

export const ORIGINES_BANC: readonly string[] = [
  ORIGINE,
  'http://localhost:8787',
  ...ORIGINES_SITE,
];

/**
 * La limite de débit de Better Auth vit dans une mémoire partagée par tout le processus : chaque banc
 * reçoit sa propre adresse IP (plage de test 198.18.0.0/15) pour ne pas compter les requêtes des autres tests.
 */
let compteurIp = 0;
export function ipUnique(): string {
  compteurIp += 1;
  return `198.18.${String(Math.floor(compteurIp / 250))}.${String((compteurIp % 250) + 1)}`;
}

/** Les Set-Cookie d'une réponse, un par en-tête. */
export function cookiesPoses(reponse: Response): string[] {
  return reponse.headers.getSetCookie();
}

/** Envoyeur qui garde les messages : le dernier code se lit dans le sujet. */
export function envoyeurMemoire(): Envoyeur & {
  readonly messages: Message[];
  dernierCode(): string;
} {
  const messages: Message[] = [];
  return {
    messages,
    envoyer(message) {
      messages.push(message);
      return Promise.resolve();
    },
    dernierCode() {
      const dernier = messages.at(-1);
      const code = /\b(\d{6})\b/.exec(dernier?.sujet ?? '');
      return code?.[1] ?? '';
    },
  };
}

/** Une jarre à cookies minimale : garde les Set-Cookie et les renvoie, honore Max-Age=0. */
export function jarre(): {
  readonly cookies: Map<string, string>;
  absorber(reponse: Response): void;
  entete(): string | undefined;
} {
  const cookies = new Map<string, string>();
  return {
    cookies,
    absorber(reponse) {
      for (const brut of cookiesPoses(reponse)) {
        const [paire = '', ...attributs] = brut.split(';');
        const [nom = '', ...valeur] = paire.split('=');
        const expire = attributs.some((a) => /^\s*max-age=0$/i.test(a));
        if (expire || valeur.join('=') === '') cookies.delete(nom.trim());
        else cookies.set(nom.trim(), valeur.join('='));
      }
    },
    entete() {
      if (cookies.size === 0) return undefined;
      return [...cookies.entries()].map(([n, v]) => `${n}=${v}`).join('; ');
    },
  };
}

export interface OptionsRequete {
  readonly method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly corps?: unknown;
  /** Corps envoyé tel quel (JSON illisible, corps trop gros). */
  readonly brut?: string;
  readonly headers?: Readonly<Record<string, string>>;
  /** En-tête Origin : celui du banc par défaut, `null` pour ne pas l'envoyer. */
  readonly origine?: string | null;
}

export interface Banc {
  readonly deps: Dependances;
  readonly journal: ReturnType<typeof journalMemoire>;
  readonly courriel: ReturnType<typeof envoyeurMemoire>;
  readonly cookies: ReturnType<typeof jarre>;
  readonly ip: string;
  /** Requête sur l'origine du banc, avec en-têtes Origin, IP et cookies, corps JSON si `corps` est fourni. */
  readonly requete: (chemin: string, options?: OptionsRequete) => Promise<Response>;
}

/** Une application avec des doubles : base mémoire, envoyeur mémoire, journal mémoire. */
export function banc(surcharges: Partial<Dependances> = {}, origine = ORIGINE): Banc {
  const journal = journalMemoire();
  const courriel = envoyeurMemoire();
  const ip = ipUnique();
  const deps: Dependances = {
    environnement: 'dev',
    secret: 'secret-de-test-assez-long-pour-better-auth-0123',
    base: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    // Sans tables : une route de gestion rendrait 503 ; les tests de gestion utilisent bancD1.
    gestion: depotD1(d1SurSqlite(new DatabaseSync(':memory:')).base),
    argent: depotArgentD1(d1SurSqlite(new DatabaseSync(':memory:')).base),
    bail: depotBailD1(d1SurSqlite(new DatabaseSync(':memory:')).base),
    projets: depotProjetsD1(d1SurSqlite(new DatabaseSync(':memory:')).base),
    partages: depotPartagesD1(d1SurSqlite(new DatabaseSync(':memory:')).base, 'sel-de-test'),
    courriel,
    fournisseurs: {},
    origines: ORIGINES_BANC,
    journal,
    maintenant: () => Date.now(),
    ...surcharges,
  };
  const app = creerApp(deps);
  const cookies = jarre();
  return {
    deps,
    journal,
    courriel,
    cookies,
    ip,
    requete: async (chemin, options = {}) => {
      const headers: Record<string, string> = { 'cf-connecting-ip': ip };
      const enteteOrigine = options.origine === undefined ? origine : options.origine;
      if (enteteOrigine !== null) headers.Origin = enteteOrigine;
      // Les en-têtes du test l'emportent (un test CSRF fournit son propre Origin).
      Object.assign(headers, options.headers);
      const cookie = cookies.entete();
      if (cookie !== undefined) headers.Cookie = cookie;
      const init: RequestInit = { method: options.method ?? 'GET', headers };
      const corps =
        options.brut ?? (options.corps === undefined ? undefined : JSON.stringify(options.corps));
      if (corps !== undefined) {
        headers['Content-Type'] = 'application/json';
        init.body = corps;
        init.method = options.method ?? 'POST';
      }
      const reponse = await app.request(`${origine}${chemin}`, init);
      cookies.absorber(reponse);
      return reponse;
    },
  };
}

export interface OptionsBancD1 {
  readonly surcharges?: Partial<Dependances>;
  /** Réglages du dépôt de gestion (limite de biens, horloge). */
  readonly optionsDepot?: OptionsDepot;
  /** Réglages du dépôt des dépenses et des prêts (horloge, limite de dépenses). */
  readonly optionsArgent?: OptionsDepotArgent;
  /** Réglages du dépôt des projets (horloge, limite, taille de page). */
  readonly optionsProjets?: OptionsDepotProjets;
  /** Réglages du dépôt des liens de partage (horloge, limite par heure, tirage). */
  readonly optionsPartages?: OptionsDepotPartages;
  /** Une base existante (plusieurs comptes sur les mêmes données) ; sinon une base neuve en mémoire. */
  readonly sqlite?: DatabaseSync;
  /** Nombre de migrations appliquées à une base neuve (toutes par défaut). */
  readonly migrations?: number;
  readonly origine?: string;
}

export interface BancD1 extends Banc {
  readonly sqlite: DatabaseSync;
}

/** Comptes et gestion sur la même D1 simulée : vraies requêtes SQL, vraies clés étrangères. */
export function bancD1(options: OptionsBancD1 = {}): BancD1 {
  const sqlite = options.sqlite ?? new DatabaseSync(':memory:');
  if (options.sqlite === undefined) appliquerMigrations(sqlite, options.migrations);
  const d1 = d1SurSqlite(sqlite);
  const b = banc(
    {
      base: d1.base,
      gestion: depotD1(d1.base, options.optionsDepot),
      argent: depotArgentD1(d1.base, options.optionsArgent),
      bail: depotBailD1(d1.base, options.optionsDepot),
      projets: depotProjetsD1(d1.base, options.optionsProjets),
      partages: depotPartagesD1(d1.base, 'sel-de-test', options.optionsPartages),
      ...options.surcharges,
    },
    options.origine,
  );
  return { ...b, sqlite };
}

/** Ouvre une session par code e-mail sur le banc (le cookie reste dans sa jarre). */
export async function connecter(b: Banc, email: string): Promise<void> {
  await b.requete('/api/auth/email-otp/send-verification-otp', {
    corps: { email, type: 'sign-in' },
  });
  const reponse = await b.requete('/api/auth/sign-in/email-otp', {
    corps: { email, otp: b.courriel.dernierCode() },
  });
  if (reponse.status !== 200) throw new Error(`Connexion impossible (${String(reponse.status)})`);
}

/** Nombre de lignes d'une table de la base simulée. */
export function compter(sqlite: DatabaseSync, table: string): number {
  return Number(sqlite.prepare(`select count(*) as n from "${table}"`).get()?.n ?? 0);
}
