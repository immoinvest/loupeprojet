import type { BetterAuthOptions } from 'better-auth';

import type { Dependances } from './dependances';
import { messageDe } from './erreurs';
import { ORIGINE_APPLE, secretClientApple } from './fournisseurs';

export type Sociaux = NonNullable<BetterAuthOptions['socialProviders']>;

/**
 * Google et Apple, seulement s'ils sont configurés. Le secret Apple est signé à la création de
 * l'instance ; une clé illisible désactive Apple (journalisé) sans empêcher les autres méthodes.
 */
export function fournisseursSociaux(deps: Dependances): Sociaux {
  const { google, apple } = deps.fournisseurs;
  const sociaux: Sociaux = {};
  if (google !== undefined) {
    sociaux.google = {
      clientId: google.clientId,
      clientSecret: google.clientSecret,
      prompt: 'select_account',
    };
  }
  if (apple !== undefined) {
    sociaux.apple = async () => {
      try {
        return {
          clientId: apple.clientId,
          clientSecret: await secretClientApple(apple, deps.maintenant),
        };
      } catch (erreur) {
        deps.journal.erreur('apple.configuration', { raison: messageDe(erreur) });
        return { clientId: apple.clientId, clientSecret: '', enabled: false };
      }
    };
  }
  return sociaux;
}

/** Apple renvoie l'utilisateur par un POST depuis son domaine : il doit être une origine de confiance. */
export function originesDeConfiance(deps: Dependances): string[] {
  return deps.fournisseurs.apple === undefined
    ? [...deps.origines]
    : [...deps.origines, ORIGINE_APPLE];
}
