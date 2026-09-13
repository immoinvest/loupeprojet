import type { Hono } from 'hono';

import { creerApp } from './app';
import { dependancesDepuisEnv, type Bindings } from './dependances';

let app: Hono | undefined;

/** Point d'entrée Cloudflare : l'application est construite une fois par isolat, à la première requête. */
export default {
  fetch(requete: Request, env: Bindings, contexte: ExecutionContext): Response | Promise<Response> {
    app ??= creerApp(dependancesDepuisEnv(env));
    return app.fetch(requete, env, contexte);
  },
};
