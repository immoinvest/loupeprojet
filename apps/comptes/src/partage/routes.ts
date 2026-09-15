import {
  alleger,
  DemandePartageSchema,
  DemandeSuppressionPartageSchema,
  ID_PARTAGE,
  TAILLE_MAX_PARTAGE,
} from '@loupe/projets';
import { Hono, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import type { Dependances } from '../dependances';
import { messageDe, reponseErreur } from '../erreurs';
import { origineConnue } from '../garde';
import { estTablePartageAbsente } from './depot';

const LECTURES: ReadonlySet<string> = new Set(['GET', 'HEAD']);

/**
 * Sans compte, mais pas depuis n'importe où : l'hôte est le nôtre, une écriture porte un en-tête Origin
 * connu. Les réponses ne sont jamais mises en cache (un lien arrêté ne doit plus s'ouvrir).
 */
function origines(deps: Pick<Dependances, 'origines'>): MiddlewareHandler {
  return async (c, next) => {
    const hote = new URL(c.req.url).origin;
    const entete = c.req.header('Origin') ?? '';
    const ecriture = !LECTURES.has(c.req.method);
    if (
      !origineConnue(hote, deps.origines) ||
      (ecriture && !origineConnue(entete, deps.origines))
    ) {
      return reponseErreur(403, 'ORIGINE_INCONNUE');
    }
    await next();
    c.res.headers.set('Cache-Control', 'no-store');
  };
}

const limiteCorps = bodyLimit({
  maxSize: TAILLE_MAX_PARTAGE,
  onError: () => reponseErreur(413, 'CORPS_TROP_GROS'),
});

/** Les routes /api/partage : créer, ouvrir et arrêter un lien de partage court (ADR-009). */
export function routeurPartage(deps: Dependances): Hono {
  const app = new Hono();
  app.use('*', origines(deps));

  app.post('/', limiteCorps, async (c) => {
    const demande = DemandePartageSchema.safeParse(await c.req.json().catch(() => undefined));
    if (!demande.success) return reponseErreur(400, 'CHAMPS_INVALIDES');
    const ip = c.req.header('cf-connecting-ip') ?? 'inconnue';
    const cree = await deps.partages.creer(JSON.stringify(alleger(demande.data.projet)), ip);
    if (cree === 'limite') return reponseErreur(429, 'LIMITE_ATTEINTE');
    return c.json(cree, 201);
  });

  app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const ouvert = ID_PARTAGE.test(id) ? await deps.partages.lire(id) : null;
    if (ouvert === null) return reponseErreur(404, 'INTROUVABLE');
    // Le contenu stocké est la sérialisation d'un projet validé : recopié sans être réanalysé.
    return c.body(
      `{"projet":${ouvert.contenu},"expireLe":${JSON.stringify(ouvert.expireLe)}}`,
      200,
      { 'Content-Type': 'application/json; charset=UTF-8' },
    );
  });

  app.delete('/:id', limiteCorps, async (c) => {
    const id = c.req.param('id');
    const demande = DemandeSuppressionPartageSchema.safeParse(
      await c.req.json().catch(() => undefined),
    );
    if (!demande.success) return reponseErreur(400, 'CHAMPS_INVALIDES');
    const supprime = ID_PARTAGE.test(id) && (await deps.partages.supprimer(id, demande.data.jeton));
    return supprime ? c.body(null, 204) : reponseErreur(404, 'INTROUVABLE');
  });

  app.onError((erreur, c) => {
    if (estTablePartageAbsente(erreur)) {
      deps.journal.erreur('partage.indisponible', { chemin: c.req.path });
      return reponseErreur(503, 'PARTAGE_INDISPONIBLE');
    }
    deps.journal.erreur('erreur.interne', { chemin: c.req.path, raison: messageDe(erreur) });
    return reponseErreur(500, 'ERREUR_INTERNE');
  });

  return app;
}
