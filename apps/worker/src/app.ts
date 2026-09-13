import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { origineAutorisee } from './cors';
import type { Dependances } from './dependances';
import { reponseErreur } from './erreurs';
import { creerProxy } from './proxy/proxy';

export const VERSION_WORKER = '0.1.0';

/** L'application Hono, construite à partir de dépendances injectées (réelles en production, doubles en test). */
export function creerApp(deps: Dependances): Hono {
  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: (origine) => (origineAutorisee(origine, deps.origines) ? origine : ''),
      allowMethods: ['GET', 'OPTIONS'],
      maxAge: 86_400,
    }),
  );

  app.get('/health', (c) =>
    c.json({ ok: true, version: VERSION_WORKER, environnement: deps.environnement }),
  );

  app.use('/proxy/*', async (c, next) => {
    const ip = c.req.header('CF-Connecting-IP') ?? 'inconnue';
    const { success } = await deps.limiteur.limit({ key: ip });
    if (!success) {
      deps.journal.info('debit.refuse', { chemin: c.req.path });
      return reponseErreur(429, 'TROP_DE_REQUETES');
    }
    await next();
  });
  app.get('/proxy/:service', creerProxy(deps));

  app.notFound(() => reponseErreur(404, 'INTROUVABLE'));
  app.onError((erreur, c) => {
    deps.journal.erreur('erreur.interne', { chemin: c.req.path, raison: erreur.message });
    return reponseErreur(500, 'ERREUR_INTERNE');
  });

  return app;
}
