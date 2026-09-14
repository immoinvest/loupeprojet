import {
  CreationLocationSchema,
  DemandeDocumentSchema,
  FinLocationSchema,
  IdentiteBailleurSchema,
  ModificationLocationSchema,
  NouveauPaiementSchema,
  NouvelleOccupationSchema,
  PreferencesMenuSchema,
} from '@loupe/gestion';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { z } from 'zod';

import type { Auth } from '../auth';
import type { Dependances } from '../dependances';
import { messageDe, reponseErreur } from '../erreurs';
import { acces, type EnvGestion } from './acces';
import { ErreurGestion, estTableAbsente } from './depot';

/** Un corps de requête plus gros est refusé avant d'être lu (l'instantané d'un projet pèse quelques Ko). */
export const TAILLE_MAX_OCTETS = 64 * 1024;

const STATUTS_METIER = {
  INTROUVABLE: 404,
  HORS_LOCATION: 400,
  LIMITE_ATTEINTE: 409,
  MONTANT_DEPASSE: 409,
  DATE_INVALIDE: 400,
  DOCUMENT_EMIS: 409,
  BAILLEUR_MANQUANT: 409,
  LOYER_NON_REGLE: 409,
  LOYER_REGLE: 409,
  FIN_AVANT_ENTREE: 400,
  PAIEMENTS_APRES_SORTIE: 409,
  BIEN_OCCUPE: 409,
  PERIODE_PAYEE: 409,
} as const;

/** Le corps JSON validé par le schéma, ou `null` s'il est illisible ou invalide. */
async function lireCorps<T>(c: Context<EnvGestion>, schema: z.ZodType<T>): Promise<T | null> {
  const corps: unknown = await c.req.json().catch(() => undefined);
  const lu = schema.safeParse(corps);
  return lu.success ? lu.data : null;
}

/** Les routes /api/gestion/* : l'état du compte, la création d'un bien loué, les paiements, le menu. */
export function routeurGestion(
  deps: Dependances,
  auth: (origine: string) => Auth,
): Hono<EnvGestion> {
  const app = new Hono<EnvGestion>();
  app.use('*', acces(deps, auth));
  app.use(
    '*',
    bodyLimit({
      maxSize: TAILLE_MAX_OCTETS,
      onError: () => reponseErreur(413, 'CORPS_TROP_GROS'),
    }),
  );

  app.get('/etat', async (c) => c.json(await deps.gestion.etat(c.get('userId'))));

  app.post('/locations', async (c) => {
    const creation = await lireCorps(c, CreationLocationSchema);
    if (creation === null) return reponseErreur(400, 'CHAMPS_INVALIDES');
    return c.json(await deps.gestion.creer(c.get('userId'), creation), 201);
  });

  app.post('/paiements', async (c) => {
    const paiement = await lireCorps(c, NouveauPaiementSchema);
    if (paiement === null) return reponseErreur(400, 'CHAMPS_INVALIDES');
    return c.json(await deps.gestion.payer(c.get('userId'), paiement), 201);
  });

  app.delete('/paiements/:id', async (c) => {
    await deps.gestion.annulerPaiement(c.get('userId'), c.req.param('id'));
    return c.body(null, 204);
  });

  app.put('/preferences', async (c) => {
    const preferences = await lireCorps(c, PreferencesMenuSchema);
    if (preferences === null) return reponseErreur(400, 'CHAMPS_INVALIDES');
    return c.json(await deps.gestion.enregistrerPreferences(c.get('userId'), preferences));
  });

  app.put('/bailleur', async (c) => {
    const identite = await lireCorps(c, IdentiteBailleurSchema);
    if (identite === null) return reponseErreur(400, 'CHAMPS_INVALIDES');
    return c.json(await deps.gestion.enregistrerBailleur(c.get('userId'), identite));
  });

  app.post('/documents', async (c) => {
    const demande = await lireCorps(c, DemandeDocumentSchema);
    if (demande === null) return reponseErreur(400, 'CHAMPS_INVALIDES');
    const { document, nouveau } = await deps.gestion.emettreDocument(c.get('userId'), demande);
    return c.json(document, nouveau ? 201 : 200);
  });

  app.get('/documents/:id', async (c) =>
    c.json(await deps.gestion.document(c.get('userId'), c.req.param('id'))),
  );

  app.patch('/locations/:id', async (c) => {
    const modification = await lireCorps(c, ModificationLocationSchema);
    if (modification === null) return reponseErreur(400, 'CHAMPS_INVALIDES');
    return c.json(
      await deps.gestion.modifierLocation(c.get('userId'), c.req.param('id'), modification),
    );
  });

  app.post('/locations/:id/fin', async (c) => {
    const corps = await lireCorps(c, FinLocationSchema);
    if (corps === null) return reponseErreur(400, 'CHAMPS_INVALIDES');
    return c.json(
      await deps.gestion.terminerLocation(c.get('userId'), c.req.param('id'), corps.fin),
    );
  });

  app.post('/biens/:id/locations', async (c) => {
    const occupation = await lireCorps(c, NouvelleOccupationSchema);
    if (occupation === null) return reponseErreur(400, 'CHAMPS_INVALIDES');
    return c.json(await deps.gestion.louer(c.get('userId'), c.req.param('id'), occupation), 201);
  });

  // Une lecture : un simple lien de téléchargement suffit (session exigée, pas d'en-tête Origin).
  app.get('/export', async (c) => {
    const exporte = await deps.gestion.exporter(c.get('userId'));
    const jour = exporte.exporteLe.slice(0, 10);
    c.header('Content-Disposition', `attachment; filename="deklic-gestion-${jour}.json"`);
    return c.json(exporte);
  });

  app.onError((erreur, c) => {
    if (erreur instanceof ErreurGestion) {
      return reponseErreur(STATUTS_METIER[erreur.code], erreur.code);
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
