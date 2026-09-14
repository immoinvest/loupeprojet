import type { MiddlewareHandler } from 'hono';

import type { Auth } from '../auth';
import type { Dependances } from '../dependances';
import { reponseErreur } from '../erreurs';
import { origineConnue } from '../garde';

export interface EnvGestion {
  Variables: { userId: string };
}

const LECTURES: ReadonlySet<string> = new Set(['GET', 'HEAD']);

/**
 * Avant toute route de gestion : l'hôte est le nôtre ; une écriture porte un en-tête Origin connu
 * (en plus du cookie SameSite=Lax) ; une session est ouverte. Les réponses ne sont jamais mises en cache.
 */
export function acces(
  deps: Pick<Dependances, 'origines'>,
  auth: (origine: string) => Auth,
): MiddlewareHandler<EnvGestion> {
  return async (c, next) => {
    const origine = new URL(c.req.url).origin;
    const entete = c.req.header('Origin') ?? '';
    const ecriture = !LECTURES.has(c.req.method);
    if (
      !origineConnue(origine, deps.origines) ||
      (ecriture && !origineConnue(entete, deps.origines))
    ) {
      return reponseErreur(403, 'ORIGINE_INCONNUE');
    }
    const session = await auth(origine).api.getSession({ headers: c.req.raw.headers });
    if (session === null) return reponseErreur(401, 'NON_CONNECTE');
    c.set('userId', session.user.id);
    await next();
    c.res.headers.set('Cache-Control', 'no-store');
  };
}
