import { Hono } from 'hono';

import type { Dependances } from './dependances';
import { reponseErreur } from './erreurs';
import { disponibles } from './fournisseurs';

export const VERSION_COMPTES = '0.1.0';

/** L'application Hono des comptes, construite à partir de dépendances injectées (réelles en production, doubles en test). */
export function creerApp(deps: Dependances): Hono {
  const app = new Hono();

  app.get('/api/comptes/sante', (c) =>
    c.json({ ok: true, version: VERSION_COMPTES, environnement: deps.environnement }),
  );

  app.get('/api/comptes/fournisseurs', (c) =>
    c.json(disponibles(deps.fournisseurs, deps.environnement === 'dev'), 200, {
      'Cache-Control': 'no-store',
    }),
  );

  app.notFound(() => reponseErreur(404, 'INTROUVABLE'));
  app.onError((erreur, c) => {
    deps.journal.erreur('erreur.interne', { chemin: c.req.path, raison: erreur.message });
    return reponseErreur(500, 'ERREUR_INTERNE');
  });

  return app;
}
