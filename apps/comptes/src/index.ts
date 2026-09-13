import type { Hono } from 'hono';

import { creerApp } from './app';
import { dependancesDepuisEnv, type Bindings } from './dependances';
import { reponseErreur } from './erreurs';

export interface Gestionnaire {
  fetch(requete: Request, env: Bindings, contexte: ExecutionContext): Promise<Response>;
}

function estApi(chemin: string): boolean {
  return chemin === '/api' || chemin.startsWith('/api/');
}

/**
 * Le worker Pages : /api/* va à l'application (construite une fois par isolat, à la première requête) ;
 * tout le reste va aux fichiers statiques du site (binding ASSETS, absent en `wrangler dev`).
 */
export function creerGestionnaire(
  construire: (env: Bindings) => Hono = (env) => creerApp(dependancesDepuisEnv(env)),
): Gestionnaire {
  let app: Hono | undefined;
  return {
    async fetch(requete, env, contexte) {
      if (estApi(new URL(requete.url).pathname)) {
        app ??= construire(env);
        return app.fetch(requete, env, contexte);
      }
      if (env.ASSETS !== undefined) return env.ASSETS.fetch(requete);
      return reponseErreur(404, 'INTROUVABLE');
    },
  };
}

export default creerGestionnaire();
