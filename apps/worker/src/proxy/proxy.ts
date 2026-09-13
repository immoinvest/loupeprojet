import type { Handler } from 'hono';
import type { BlankEnv } from 'hono/types';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { Dependances } from '../dependances';
import { messageDe, reponseErreur, type CodeErreur } from '../erreurs';
import { ecrireCache, lireCache, repondre } from '../http';
import type { Service } from '../services';
import { cleCache } from './cache';

const AGENT = 'Loupe/0.1 (+https://loupeprojet.pages.dev)';

type ResultatAmont =
  | { readonly ok: true; readonly donnees: unknown }
  | {
      readonly ok: false;
      readonly statut: ContentfulStatusCode;
      readonly code: CodeErreur;
      readonly details?: Readonly<Record<string, unknown>>;
    };

async function appelerAmont(deps: Dependances, service: Service, url: URL): Promise<ResultatAmont> {
  let reponse: Response;
  try {
    reponse = await deps.fetcher(url, {
      signal: AbortSignal.timeout(service.delaiMs),
      headers: { accept: 'application/json', 'user-agent': AGENT },
    });
  } catch (erreur) {
    deps.journal.erreur('amont.injoignable', { service: service.nom, raison: messageDe(erreur) });
    return { ok: false, statut: 502, code: 'AMONT_INDISPONIBLE' };
  }
  if (reponse.status === 429) {
    deps.journal.erreur('amont.sature', { service: service.nom });
    return { ok: false, statut: 503, code: 'AMONT_SATURE' };
  }
  if (!reponse.ok) {
    deps.journal.erreur('amont.erreur', { service: service.nom, statutAmont: reponse.status });
    return {
      ok: false,
      statut: 502,
      code: 'AMONT_INDISPONIBLE',
      details: { statutAmont: reponse.status },
    };
  }
  let corps: unknown;
  try {
    corps = await reponse.json();
  } catch (erreur) {
    deps.journal.erreur('amont.invalide', { service: service.nom, raison: messageDe(erreur) });
    return { ok: false, statut: 502, code: 'AMONT_INVALIDE' };
  }
  try {
    return { ok: true, donnees: service.normaliser(corps) };
  } catch (erreur) {
    deps.journal.erreur('amont.invalide', { service: service.nom, raison: messageDe(erreur) });
    return { ok: false, statut: 502, code: 'AMONT_INVALIDE' };
  }
}

/**
 * GET /proxy/:service?… : paramètres validés, réponse servie depuis le cache si possible,
 * sinon appel amont avec délai, normalisation au contrat Loupe, mise en cache.
 */
export function creerProxy(deps: Dependances): Handler<BlankEnv, '/proxy/:service'> {
  return async (c) => {
    const service = deps.services[c.req.param('service')];
    if (service === undefined) return reponseErreur(404, 'SERVICE_INCONNU');
    const lecture = service.lireParametres(c.req.query());
    if (!lecture.ok) return reponseErreur(400, 'PARAMETRES_INVALIDES', { champs: lecture.champs });

    const cle = await cleCache(service.nom, lecture.parametres);
    const enCache = await lireCache(deps, cle);
    if (enCache !== null) return repondre(c, enCache, 'HIT');

    const amont = await appelerAmont(deps, service, lecture.url);
    if (!amont.ok) return reponseErreur(amont.statut, amont.code, amont.details);
    const enveloppe = {
      service: service.nom,
      obtenuLe: new Date(deps.maintenant()).toISOString(),
      donnees: amont.donnees,
    };
    const texte = JSON.stringify(enveloppe);
    await ecrireCache(deps, cle, texte, service.ttlSecondes);
    return repondre(c, texte, 'MISS');
  };
}
