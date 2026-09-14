import { lireReponse } from '@loupe/projets';
import { z } from 'zod';

import type { ClientProjets, CodeErreurSynchro } from './types';

export type Recuperateur = (url: string, init?: RequestInit) => Promise<Response>;

export const URL_SYNCHRO = '/api/projets/synchroniser';

const ErreurSchema = z.object({ code: z.string() });

/** Codes de l'API des comptes vers les codes de l'interface. */
const CODES_SERVEUR: Readonly<Record<string, CodeErreurSynchro>> = {
  NON_CONNECTE: 'non_connecte',
  CHAMPS_INVALIDES: 'invalide',
  CORPS_TROP_GROS: 'invalide',
  PROJETS_INDISPONIBLE: 'indisponible',
  CONFIGURATION_INCOMPLETE: 'indisponible',
};

async function codeDe(reponse: Response): Promise<CodeErreurSynchro> {
  const corps = ErreurSchema.safeParse(await reponse.json().catch(() => undefined));
  const connu = corps.success ? CODES_SERVEUR[corps.data.code] : undefined;
  if (connu !== undefined) return connu;
  return reponse.status >= 500 ? 'indisponible' : 'inconnue';
}

/**
 * Le client réel : l'API servie par le worker des comptes sur l'origine du site (le cookie de session
 * part tout seul, le navigateur ajoute l'en-tête Origin). La réponse est revalidée.
 */
export function clientProjetsReseau(
  recuperer: Recuperateur = (url, init) => fetch(url, init),
): ClientProjets {
  return {
    async synchroniser(demande) {
      let reponse: Response;
      try {
        reponse = await recuperer(URL_SYNCHRO, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(demande),
        });
      } catch {
        return { ok: false, code: 'reseau' };
      }
      if (!reponse.ok) return { ok: false, code: await codeDe(reponse) };
      const lue = lireReponse(await reponse.json().catch(() => undefined));
      return lue === null ? { ok: false, code: 'inconnue' } : { ok: true, valeur: lue };
    },
  };
}
