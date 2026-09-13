import type { Context, MiddlewareHandler } from 'hono';

import type { Dependances } from './dependances';
import { messageDe, reponseErreur } from './erreurs';
import type { Journal } from './journal';
import type { LimiteurDebit } from './proxy/debit';

/** Le navigateur garde une réponse une heure ; le Worker, la durée de vie du service. */
export const CACHE_NAVIGATEUR = 'public, max-age=3600';
const TYPE_JSON = 'application/json; charset=UTF-8';

export function repondre(
  c: Context,
  texte: string,
  cache: 'HIT' | 'MISS',
  cacheNavigateur = CACHE_NAVIGATEUR,
): Response {
  return c.body(texte, 200, {
    'Content-Type': TYPE_JSON,
    'Cache-Control': cacheNavigateur,
    'X-Loupe-Cache': cache,
  });
}

/** Un cache en panne ne doit jamais empêcher de répondre : on journalise et on continue. */
export async function lireCache(deps: Dependances, cle: string): Promise<string | null> {
  try {
    return await deps.cache.lire(cle);
  } catch (erreur) {
    deps.journal.erreur('cache.lecture_impossible', { cle, raison: messageDe(erreur) });
    return null;
  }
}

export async function ecrireCache(
  deps: Dependances,
  cle: string,
  valeur: string,
  ttlSecondes: number,
): Promise<void> {
  try {
    await deps.cache.ecrire(cle, valeur, ttlSecondes);
  } catch (erreur) {
    deps.journal.erreur('cache.ecriture_impossible', { cle, raison: messageDe(erreur) });
  }
}

/** Limite par adresse IP (en-tête Cloudflare) ; sans en-tête, tous partagent la clé « inconnue ». */
export function limiterDebit(limiteur: LimiteurDebit, journal: Journal): MiddlewareHandler {
  return async (c, next) => {
    const ip = c.req.header('CF-Connecting-IP') ?? 'inconnue';
    const { success } = await limiteur.limit({ key: ip });
    if (!success) {
      journal.info('debit.refuse', { chemin: c.req.path });
      return reponseErreur(429, 'TROP_DE_REQUETES');
    }
    await next();
  };
}
