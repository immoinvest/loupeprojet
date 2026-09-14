import { Hono } from 'hono';

import { creerAuth } from './auth';
import type { Dependances } from './dependances';
import { reponseErreur } from './erreurs';
import { disponibles } from './fournisseurs';
import { garde } from './garde';
import { routeurGestion } from './gestion/routes';
import { routeurProjets } from './projets/routes';

export const VERSION_COMPTES = '0.3.0';

/** L'application Hono des comptes, construite à partir de dépendances injectées (réelles en production, doubles en test). */
export function creerApp(deps: Dependances): Hono {
  const app = new Hono();
  const auth = creerAuth(deps);

  app.get('/api/comptes/sante', (c) =>
    c.json({ ok: true, version: VERSION_COMPTES, environnement: deps.environnement }),
  );

  app.get('/api/comptes/fournisseurs', (c) =>
    c.json(disponibles(deps.fournisseurs, deps.courriel !== null), 200, {
      'Cache-Control': 'no-store',
    }),
  );

  // Better Auth, derrière la garde : la requête brute (cookies, Origin) lui est passée telle quelle.
  app.use('/api/auth/*', garde(deps));
  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth(new URL(c.req.url).origin).handler(c.req.raw));

  // Gestion locative : même origine, même session, même base (ADR-G1).
  app.route('/api/gestion', routeurGestion(deps, auth));

  // Projets d'analyse synchronisés avec le compte : même garde, même base (feature sync-projets).
  app.route('/api/projets', routeurProjets(deps, auth));

  app.notFound(() => reponseErreur(404, 'INTROUVABLE'));
  app.onError((erreur, c) => {
    deps.journal.erreur('erreur.interne', { chemin: c.req.path, raison: erreur.message });
    return reponseErreur(500, 'ERREUR_INTERNE');
  });

  return app;
}
