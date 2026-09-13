import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { origineAutorisee } from './cors';
import type { Dependances } from './dependances';
import { reponseErreur } from './erreurs';
import { creerExtraction } from './extraction';
import { limiterDebit } from './http';
import { creerMarche } from './marche';
import { creerProxy } from './proxy/proxy';

export const VERSION_WORKER = '0.3.0';

/** L'application Hono, construite à partir de dépendances injectées (réelles en production, doubles en test). */
export function creerApp(deps: Dependances): Hono {
  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: (origine) => (origineAutorisee(origine, deps.origines) ? origine : ''),
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
      maxAge: 86_400,
    }),
  );

  app.get('/health', (c) =>
    c.json({
      ok: true,
      version: VERSION_WORKER,
      environnement: deps.environnement,
      extraction: deps.extracteur === null ? null : deps.extracteur.modele,
    }),
  );

  app.use('/proxy/*', limiterDebit(deps.limiteur, deps.journal));
  app.get('/proxy/:service', creerProxy(deps));

  app.use('/marche', limiterDebit(deps.limiteur, deps.journal));
  app.get('/marche', creerMarche(deps));

  app.use('/extract', limiterDebit(deps.limiteurExtraction, deps.journal));
  app.post('/extract', creerExtraction(deps));

  app.notFound(() => reponseErreur(404, 'INTROUVABLE'));
  app.onError((erreur, c) => {
    deps.journal.erreur('erreur.interne', { chemin: c.req.path, raison: erreur.message });
    return reponseErreur(500, 'ERREUR_INTERNE');
  });

  return app;
}
