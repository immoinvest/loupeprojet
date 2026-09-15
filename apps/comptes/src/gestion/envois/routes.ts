import { ContactLocataireSchema, SaisieBailleurBienSchema } from '@loupe/gestion';
import { Hono, type Context } from 'hono';

import type { Dependances } from '../../dependances';
import { messageDe, reponseErreur } from '../../erreurs';
import type { EnvGestion } from '../acces';
import { ErreurGestion } from '../depot';
import { ErreurEnvois, estTableEnvoisAbsente, STATUTS_ERREUR_ENVOIS } from './depot';
import { renvoyerDocument } from './quittances';
import { declarerAccord, etatEnvois, inviterDeNouveau, type ContexteEnvois } from './taches';

/** Une réponse d'erreur des envois, ou `null` pour une erreur que ce module ne connaît pas. */
export function reponseErreurEnvois(deps: Dependances, erreur: unknown, chemin: string): Response {
  if (erreur instanceof ErreurEnvois) {
    return reponseErreur(STATUTS_ERREUR_ENVOIS[erreur.code], erreur.code);
  }
  if (erreur instanceof ErreurGestion && erreur.code === 'INTROUVABLE') {
    return reponseErreur(404, 'INTROUVABLE');
  }
  if (estTableEnvoisAbsente(erreur)) {
    deps.journal.erreur('envois.indisponible', { chemin });
    return reponseErreur(503, 'ENVOIS_INDISPONIBLE');
  }
  deps.journal.erreur('erreur.interne', { chemin, raison: messageDe(erreur) });
  return reponseErreur(500, 'ERREUR_INTERNE');
}

/**
 * Les routes /api/gestion/envois/* (derrière la garde de session de Gérer) : état, accord déclaré,
 * nouvelle invitation, téléphone, identité du bailleur d'un bien, renvoi d'une quittance.
 */
export function routeurEnvois(deps: Dependances): Hono<EnvGestion> {
  const app = new Hono<EnvGestion>();
  const contexte = (c: Context<EnvGestion>): ContexteEnvois => ({
    deps,
    userId: c.get('userId'),
    origine: new URL(c.req.url).origin,
  });
  const maintenant = (): string => new Date(deps.maintenant()).toISOString();
  const corps = (c: Context<EnvGestion>): Promise<unknown> => c.req.json().catch(() => undefined);

  app.get('/', async (c) => c.json(await etatEnvois(contexte(c))));

  app.post('/locataires/:id/accord', async (c) =>
    c.json(await declarerAccord(contexte(c), c.req.param('id'))),
  );

  app.post('/locataires/:id/invitation', async (c) =>
    c.json(await inviterDeNouveau(contexte(c), c.req.param('id'))),
  );

  app.put('/locataires/:id/contact', async (c) => {
    const lu = ContactLocataireSchema.safeParse(await corps(c));
    if (!lu.success) return reponseErreur(400, 'CHAMPS_INVALIDES');
    await deps.envois.enregistrerContact(
      c.get('userId'),
      c.req.param('id'),
      lu.data.telephone,
      maintenant(),
    );
    return c.json(lu.data);
  });

  app.put('/biens/:id/bailleur', async (c) => {
    const lu = SaisieBailleurBienSchema.safeParse(await corps(c));
    if (!lu.success) return reponseErreur(400, 'CHAMPS_INVALIDES');
    await deps.envois.enregistrerBailleurBien(
      c.get('userId'),
      c.req.param('id'),
      lu.data.bailleur,
      maintenant(),
    );
    return c.json(lu.data);
  });

  app.post('/documents/:id/renvoyer', async (c) =>
    c.json(await renvoyerDocument(contexte(c), c.req.param('id'))),
  );

  app.onError((erreur, c) => reponseErreurEnvois(deps, erreur, c.req.path));

  return app;
}
