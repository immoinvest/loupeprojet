import type { MiddlewareHandler } from 'hono';
import { z } from 'zod';

import { CHEMIN_AUTH } from './auth';
import type { Dependances } from './dependances';
import { reponseErreur } from './erreurs';

/**
 * Les routes Better Auth dont l'application se sert. Toutes les autres (mot de passe, changement
 * d'adresse, vérification par lien…) restent fermées : moins de surface, aucun effet de bord oublié.
 */
export const ROUTES_AUTH: ReadonlySet<string> = new Set([
  'POST /email-otp/send-verification-otp',
  'POST /sign-in/email-otp',
  'POST /sign-in/social',
  'GET /callback/google',
  'GET /callback/apple',
  'POST /callback/apple',
  'GET /get-session',
  'POST /sign-out',
  'POST /update-user',
  'GET /list-accounts',
  'POST /delete-user',
  'GET /error',
]);

const DEMANDE_CODE = 'POST /email-otp/send-verification-otp';
const DemandeCodeSchema = z.object({ type: z.literal('sign-in') });

function echapper(texte: string): string {
  return texte.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

/** L'origine figure dans la liste ; `*` remplace un sous-domaine (https://*.loupeprojet.pages.dev). */
export function origineConnue(origine: string, motifs: readonly string[]): boolean {
  return motifs.some((motif) => {
    if (!motif.includes('*')) return motif === origine;
    const expression = motif.split('*').map(echapper).join('[a-z0-9-]+');
    return new RegExp(`^${expression}$`).test(origine);
  });
}

/**
 * Avant Better Auth : l'hôte doit être le nôtre (l'origine de la requête sert d'URL de base aux
 * redirections), la route doit être utilisée, et seul le code de connexion peut être demandé.
 */
const MISE_A_JOUR = 'POST /update-user';
export const LONGUEUR_NOM_MAX = 80;
/** Seul le nom affiché se modifie, et il reste court : pas d'image ni de champ arbitraire stockés. */
const MiseAJourSchema = z.strictObject({ name: z.string().max(LONGUEUR_NOM_MAX) });

function corpsJson(requete: Request): Promise<unknown> {
  return requete
    .clone()
    .json()
    .catch(() => null);
}

export function garde(deps: Dependances): MiddlewareHandler {
  return async (c, next) => {
    const url = new URL(c.req.url);
    if (!origineConnue(url.origin, deps.origines)) return reponseErreur(403, 'ORIGINE_INCONNUE');
    const route = `${c.req.method} ${url.pathname.slice(CHEMIN_AUTH.length)}`;
    if (!ROUTES_AUTH.has(route)) return reponseErreur(404, 'INTROUVABLE');
    if (route === MISE_A_JOUR && !MiseAJourSchema.safeParse(await corpsJson(c.req.raw)).success) {
      return reponseErreur(400, 'CHAMPS_INVALIDES');
    }
    if (route === DEMANDE_CODE) {
      if (deps.courriel === null) return reponseErreur(503, 'COURRIEL_INDISPONIBLE');
      const corps = await c.req.raw
        .clone()
        .json()
        .catch(() => null);
      if (!DemandeCodeSchema.safeParse(corps).success) {
        return reponseErreur(400, 'TYPE_NON_PRIS_EN_CHARGE');
      }
    }
    await next();
  };
}
