import type { ExecutionContext } from '@cloudflare/workers-types';
import type { Hono } from 'hono';

import { creerApp } from './app';
import { dependancesDepuisEnv, type Bindings } from './dependances';
import { messageDe, reponseErreur } from './erreurs';
import { journalConsole, type Journal } from './journal';

export interface Gestionnaire {
  fetch(requete: Request, env: Bindings, contexte: ExecutionContext): Promise<Response>;
}

function estApi(chemin: string): boolean {
  return chemin === '/api' || chemin.startsWith('/api/');
}

/**
 * Le worker Pages : /api/* va à l'application (construite une fois par isolat, à la première requête) ;
 * tout le reste va aux fichiers statiques du site (binding ASSETS, absent en `wrangler dev`).
 * Une configuration incomplète (secret, base) rend 503 sur /api/* sans toucher au site.
 */
export function creerGestionnaire(
  construire: (env: Bindings) => Hono = (env) => creerApp(dependancesDepuisEnv(env)),
  journal: Journal = journalConsole,
): Gestionnaire {
  let app: Hono | undefined;
  return {
    async fetch(requete, env, contexte) {
      if (estApi(new URL(requete.url).pathname)) {
        try {
          app ??= construire(env);
        } catch (erreur) {
          journal.erreur('configuration.incomplete', { raison: messageDe(erreur) });
          return reponseErreur(503, 'CONFIGURATION_INCOMPLETE');
        }
        return app.fetch(requete, env, contexte);
      }
      if (env.ASSETS !== undefined) return env.ASSETS.fetch(requete);
      return reponseErreur(404, 'INTROUVABLE');
    },
  };
}

export default creerGestionnaire();
