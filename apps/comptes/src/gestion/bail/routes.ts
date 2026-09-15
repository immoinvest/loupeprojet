import { DemandeRevisionSchema, LegalBienSaisieSchema, RevisionSaisieSchema } from '@loupe/gestion';
import { Hono, type Context } from 'hono';
import type { z } from 'zod';

import type { Dependances } from '../../dependances';
import { messageDe, reponseErreur } from '../../erreurs';
import type { EnvGestion } from '../acces';
import { ErreurGestion, estTableAbsente } from '../depot';
import { ErreurBail, estTableBailAbsente } from './depot';

const STATUTS = {
  INTROUVABLE: 404,
  REVISION_IMPOSSIBLE: 409,
  BAILLEUR_MANQUANT: 409,
  HORS_LOCATION: 400,
  LIMITE_ATTEINTE: 409,
  PERIODE_PAYEE: 409,
} as const;

async function lireCorps<T>(c: Context<EnvGestion>, schema: z.ZodType<T>): Promise<T | null> {
  const lu = schema.safeParse(await c.req.json().catch(() => undefined));
  return lu.success ? lu.data : null;
}

/**
 * /api/gestion/bail/* (ADR-G24) : DPE et zone tendue d'un bien, réglages et application de la révision,
 * lettres. Monté sous le routeur de gestion : garde de session, Origin et taille du corps viennent de lui.
 */
export function routeurBail(deps: Dependances): Hono<EnvGestion> {
  const app = new Hono<EnvGestion>();

  app.get('/', async (c) => c.json(await deps.bail.etat(c.get('userId'))));

  app.put('/biens/:id', async (c) => {
    const saisie = await lireCorps(c, LegalBienSaisieSchema);
    if (saisie === null) return reponseErreur(400, 'CHAMPS_INVALIDES');
    return c.json(await deps.bail.enregistrerBien(c.get('userId'), c.req.param('id'), saisie));
  });

  app.put('/locations/:id/revision', async (c) => {
    const saisie = await lireCorps(c, RevisionSaisieSchema);
    if (saisie === null) return reponseErreur(400, 'CHAMPS_INVALIDES');
    return c.json(await deps.bail.enregistrerRevision(c.get('userId'), c.req.param('id'), saisie));
  });

  app.post('/locations/:id/revision/appliquer', async (c) => {
    const demande = await lireCorps(c, DemandeRevisionSchema);
    if (demande === null) return reponseErreur(400, 'CHAMPS_INVALIDES');
    const { resultat, nouvelle } = await deps.bail.appliquerRevision(
      c.get('userId'),
      c.req.param('id'),
      demande.anniversaire,
    );
    return c.json(resultat, nouvelle ? 201 : 200);
  });

  app.get('/lettres/:id', async (c) =>
    c.json(await deps.bail.lettre(c.get('userId'), c.req.param('id'))),
  );

  app.onError((erreur, c) => {
    if (erreur instanceof ErreurBail) return reponseErreur(STATUTS[erreur.code], erreur.code);
    // Lecture d'une location partagée avec G1c (`lireLocation`) : elle ne lève qu'« introuvable ».
    if (erreur instanceof ErreurGestion) return reponseErreur(404, 'INTROUVABLE');
    if (estTableBailAbsente(erreur)) {
      deps.journal.erreur('bail.indisponible', { chemin: c.req.path });
      return reponseErreur(503, 'BAIL_INDISPONIBLE');
    }
    if (estTableAbsente(erreur)) {
      deps.journal.erreur('gestion.indisponible', { chemin: c.req.path });
      return reponseErreur(503, 'GESTION_INDISPONIBLE');
    }
    deps.journal.erreur('erreur.interne', { chemin: c.req.path, raison: messageDe(erreur) });
    return reponseErreur(500, 'ERREUR_INTERNE');
  });

  return app;
}
