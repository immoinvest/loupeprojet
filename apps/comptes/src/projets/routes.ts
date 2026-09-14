import { RequeteSynchroSchema, TAILLE_MAX_REQUETE } from '@loupe/projets';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import { acces, type EnvSession } from '../acces';
import type { Auth } from '../auth';
import type { Dependances } from '../dependances';
import { messageDe, reponseErreur } from '../erreurs';
import { estTableProjetAbsente } from './depot';

/** La route /api/projets/synchroniser : les changements de l'appareil, puis ce qu'il doit recevoir. */
export function routeurProjets(
  deps: Dependances,
  auth: (origine: string) => Auth,
): Hono<EnvSession> {
  const app = new Hono<EnvSession>();
  app.use('*', acces(deps, auth));
  app.use(
    '*',
    bodyLimit({
      maxSize: TAILLE_MAX_REQUETE,
      onError: () => reponseErreur(413, 'CORPS_TROP_GROS'),
    }),
  );

  app.post('/synchroniser', async (c) => {
    const corps: unknown = await c.req.json().catch(() => undefined);
    const requete = RequeteSynchroSchema.safeParse(corps);
    if (!requete.success) return reponseErreur(400, 'CHAMPS_INVALIDES');
    const reponse = await deps.projets.synchroniser(c.get('userId'), requete.data);
    return c.body(reponse, 200, { 'Content-Type': 'application/json; charset=UTF-8' });
  });

  app.onError((erreur, c) => {
    if (estTableProjetAbsente(erreur)) {
      deps.journal.erreur('projets.indisponible', { chemin: c.req.path });
      return reponseErreur(503, 'PROJETS_INDISPONIBLE');
    }
    deps.journal.erreur('erreur.interne', { chemin: c.req.path, raison: messageDe(erreur) });
    return reponseErreur(500, 'ERREUR_INTERNE');
  });

  return app;
}
