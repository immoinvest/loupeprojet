import {
  ChangementColocataireSchema,
  CongeSaisieSchema,
  DemandeRegularisationSchema,
  ModeChargesSaisieSchema,
  RegleeSchema,
  RenduDepotSchema,
  RestitutionSaisieSchema,
} from '@loupe/gestion';
import { Hono, type Context } from 'hono';
import type { z } from 'zod';

import type { Dependances } from '../../dependances';
import { messageDe, reponseErreur } from '../../erreurs';
import type { EnvGestion } from '../acces';
import { ErreurGestion, estTableAbsente } from '../depot';
import { ErreurFinBail, estTableFinBailAbsente } from './depot';

const STATUTS = {
  INTROUVABLE: 404,
  FIN_AVANT_ENTREE: 400,
  PAIEMENTS_APRES_SORTIE: 409,
  DATE_INVALIDE: 400,
  CONGE_INVALIDE: 400,
  LOCATION_EN_COURS: 409,
  RETENUES_TROP_ELEVEES: 409,
  DEJA_ENREGISTRE: 409,
  DEPOT_RENDU: 409,
  REGULARISATION_IMPOSSIBLE: 409,
  COLOCATAIRE_REFUSE: 409,
  BAILLEUR_MANQUANT: 409,
  LIMITE_ATTEINTE: 409,
} as const;

/** Le corps validé, ou `null` : la route répond alors 400 CHAMPS_INVALIDES. */
async function lireCorps<T>(c: Context<EnvGestion>, schema: z.ZodType<T>): Promise<T | null> {
  const lu = schema.safeParse(await c.req.json().catch(() => undefined));
  return lu.success ? lu.data : null;
}

const INVALIDE = (): Response => reponseErreur(400, 'CHAMPS_INVALIDES');

/**
 * /api/gestion/fin-bail/* (ADR-G34) : congé, mode des charges, dépôt, régularisation, colocataires,
 * décomptes. Monté sous le routeur de gestion : session, Origin et taille du corps viennent de lui.
 */
export function routeurFinBail(deps: Dependances): Hono<EnvGestion> {
  const app = new Hono<EnvGestion>();
  const depot = deps.finBail;

  app.get('/', async (c) => c.json(await depot.etat(c.get('userId'))));

  app.put('/locations/:id/conge', async (c) => {
    const saisie = await lireCorps(c, CongeSaisieSchema);
    if (saisie === null) return INVALIDE();
    return c.json(await depot.enregistrerConge(c.get('userId'), c.req.param('id'), saisie));
  });

  app.delete('/locations/:id/conge', async (c) =>
    c.json(await depot.retirerConge(c.get('userId'), c.req.param('id'))),
  );

  app.put('/locations/:id/charges', async (c) => {
    const saisie = await lireCorps(c, ModeChargesSaisieSchema);
    if (saisie === null) return INVALIDE();
    return c.json(
      await depot.enregistrerModeCharges(c.get('userId'), c.req.param('id'), saisie.mode),
    );
  });

  app.post('/locations/:id/restitution', async (c) => {
    const saisie = await lireCorps(c, RestitutionSaisieSchema);
    if (saisie === null) return INVALIDE();
    return c.json(await depot.restituer(c.get('userId'), c.req.param('id'), saisie), 201);
  });

  app.post('/locations/:id/restitution/rendue', async (c) => {
    const saisie = await lireCorps(c, RenduDepotSchema);
    if (saisie === null) return INVALIDE();
    return c.json(await depot.rendreDepot(c.get('userId'), c.req.param('id'), saisie.rendueLe));
  });

  app.delete('/locations/:id/restitution', async (c) => {
    await depot.annulerRestitution(c.get('userId'), c.req.param('id'));
    return c.body(null, 204);
  });

  app.post('/locations/:id/regularisations', async (c) => {
    const demande = await lireCorps(c, DemandeRegularisationSchema);
    if (demande === null) return INVALIDE();
    return c.json(await depot.regulariser(c.get('userId'), c.req.param('id'), demande.annee), 201);
  });

  app.post('/regularisations/:id/reglee', async (c) => {
    const saisie = await lireCorps(c, RegleeSchema);
    if (saisie === null) return INVALIDE();
    return c.json(
      await depot.reglerRegularisation(c.get('userId'), c.req.param('id'), saisie.regleeLe),
    );
  });

  app.post('/locations/:id/colocataires', async (c) => {
    const changement = await lireCorps(c, ChangementColocataireSchema);
    if (changement === null) return INVALIDE();
    return c.json(
      await depot.changerColocataire(c.get('userId'), c.req.param('id'), changement),
      201,
    );
  });

  app.get('/decomptes/:id', async (c) =>
    c.json(await depot.decompte(c.get('userId'), c.req.param('id'))),
  );

  app.onError((erreur, c) => {
    if (erreur instanceof ErreurFinBail) return reponseErreur(STATUTS[erreur.code], erreur.code);
    // Lecture d'une location partagée avec G1 (`lireLocation`) : elle ne lève qu'« introuvable ».
    if (erreur instanceof ErreurGestion) return reponseErreur(404, 'INTROUVABLE');
    if (estTableFinBailAbsente(erreur)) {
      deps.journal.erreur('fin-bail.indisponible', { chemin: c.req.path });
      return reponseErreur(503, 'FIN_BAIL_INDISPONIBLE');
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
