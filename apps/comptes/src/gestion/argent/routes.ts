import { NouvelleDepenseSchema, PretBienSchema } from '@loupe/gestion';
import { Hono, type Context } from 'hono';
import type { z } from 'zod';

import type { Dependances } from '../../dependances';
import { messageDe, reponseErreur } from '../../erreurs';
import type { EnvGestion } from '../acces';
import { ErreurArgent, estTableArgentAbsente } from './depot';

const STATUTS_METIER = { INTROUVABLE: 404, LIMITE_ATTEINTE: 409 } as const;

async function lireCorps<T>(c: Context<EnvGestion>, schema: z.ZodType<T>): Promise<T | null> {
  const corps: unknown = await c.req.json().catch(() => undefined);
  const lu = schema.safeParse(corps);
  return lu.success ? lu.data : null;
}

/**
 * Dépenses et prêt d'un bien (G5-4, G5-1), montés sous /api/gestion derrière la même garde (ADR-G25).
 * Leur propre gestion d'erreurs : sans la migration 0007, ces routes seules rendent 503.
 */
export function routeurArgent(deps: Pick<Dependances, 'argent' | 'journal'>): Hono<EnvGestion> {
  const app = new Hono<EnvGestion>();

  app.get('/argent', async (c) => c.json(await deps.argent.etat(c.get('userId'))));

  app.get('/depenses', async (c) => c.json(await deps.argent.depenses(c.get('userId'))));

  app.post('/depenses', async (c) => {
    const depense = await lireCorps(c, NouvelleDepenseSchema);
    if (depense === null) return reponseErreur(400, 'CHAMPS_INVALIDES');
    return c.json(await deps.argent.ajouterDepense(c.get('userId'), depense), 201);
  });

  app.patch('/depenses/:id', async (c) => {
    const depense = await lireCorps(c, NouvelleDepenseSchema);
    if (depense === null) return reponseErreur(400, 'CHAMPS_INVALIDES');
    return c.json(await deps.argent.modifierDepense(c.get('userId'), c.req.param('id'), depense));
  });

  app.delete('/depenses/:id', async (c) => {
    await deps.argent.supprimerDepense(c.get('userId'), c.req.param('id'));
    return c.body(null, 204);
  });

  app.get('/biens/:id/pret', async (c) =>
    c.json({ pret: await deps.argent.pret(c.get('userId'), c.req.param('id')) }),
  );

  app.put('/biens/:id/pret', async (c) => {
    const pret = await lireCorps(c, PretBienSchema);
    if (pret === null) return reponseErreur(400, 'CHAMPS_INVALIDES');
    return c.json(await deps.argent.enregistrerPret(c.get('userId'), c.req.param('id'), pret));
  });

  app.delete('/biens/:id/pret', async (c) => {
    await deps.argent.supprimerPret(c.get('userId'), c.req.param('id'));
    return c.body(null, 204);
  });

  app.onError((erreur, c) => {
    if (erreur instanceof ErreurArgent) {
      return reponseErreur(STATUTS_METIER[erreur.code], erreur.code);
    }
    if (estTableArgentAbsente(erreur)) {
      deps.journal.erreur('argent.indisponible', { chemin: c.req.path });
      return reponseErreur(503, 'DEPENSES_INDISPONIBLE');
    }
    deps.journal.erreur('erreur.interne', { chemin: c.req.path, raison: messageDe(erreur) });
    return reponseErreur(500, 'ERREUR_INTERNE');
  });

  return app;
}
