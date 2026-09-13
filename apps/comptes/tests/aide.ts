import { memoryAdapter } from 'better-auth/adapters/memory';

import { creerApp } from '../src/app';
import type { Envoyeur, Message } from '../src/courriel';
import type { Dependances } from '../src/dependances';
import { journalMemoire } from '../src/journal';

export const ORIGINE = 'http://localhost:5173';

export const ORIGINES_BANC: readonly string[] = [
  ORIGINE,
  'http://localhost:8787',
  'https://loupeprojet.pages.dev',
  'https://*.loupeprojet.pages.dev',
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
  readonly method?: 'GET' | 'POST';
  readonly corps?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
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
      const headers: Record<string, string> = {
        Origin: origine,
        'cf-connecting-ip': ip,
        ...options.headers,
      };
      const cookie = cookies.entete();
      if (cookie !== undefined) headers.Cookie = cookie;
      const init: RequestInit = { method: options.method ?? 'GET', headers };
      if (options.corps !== undefined) {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(options.corps);
        init.method = options.method ?? 'POST';
      }
      const reponse = await app.request(`${origine}${chemin}`, init);
      cookies.absorber(reponse);
      return reponse;
    },
  };
}
