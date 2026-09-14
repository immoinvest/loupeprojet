import {
  CreationReponseSchema,
  EtatGestionSchema,
  PaiementSchema,
  PreferencesMenuSchema,
} from '@loupe/gestion';
import { z } from 'zod';

import type { ClientGestion, CodeErreurGestion, ResultatGestion } from './types';

export type Recuperateur = (url: string, init?: RequestInit) => Promise<Response>;

const RACINE = '/api/gestion';
const ErreurSchema = z.object({ code: z.string() });

/** Codes de l'API de gestion (apps/comptes) vers les codes de l'interface. */
const CODES_SERVEUR: Readonly<Record<string, CodeErreurGestion>> = {
  NON_CONNECTE: 'non_connecte',
  CHAMPS_INVALIDES: 'invalide',
  CORPS_TROP_GROS: 'invalide',
  INTROUVABLE: 'introuvable',
  PERIODE_DEJA_RECUE: 'deja_recu',
  GESTION_INDISPONIBLE: 'indisponible',
};

async function codeDe(reponse: Response): Promise<CodeErreurGestion> {
  const corps = ErreurSchema.safeParse(await reponse.json().catch(() => undefined));
  const connu = corps.success ? CODES_SERVEUR[corps.data.code] : undefined;
  if (connu !== undefined) return connu;
  return reponse.status >= 500 ? 'indisponible' : 'inconnue';
}

type Methode = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Le client réel : l'API /api/gestion servie par le worker des comptes, sur l'origine du site (le cookie
 * de session part tout seul ; le navigateur ajoute l'en-tête Origin aux écritures). Réponses revalidées.
 */
export function clientGestionReseau(
  recuperer: Recuperateur = (url, init) => fetch(url, init),
): ClientGestion {
  async function appeler<T>(
    methode: Methode,
    chemin: string,
    corps: unknown,
    schema: z.ZodType<T>,
  ): Promise<ResultatGestion<T>> {
    const init: RequestInit =
      corps === undefined
        ? { method: methode }
        : {
            method: methode,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(corps),
          };
    let reponse: Response;
    try {
      reponse = await recuperer(`${RACINE}${chemin}`, init);
    } catch {
      return { ok: false, code: 'reseau' };
    }
    if (!reponse.ok) return { ok: false, code: await codeDe(reponse) };
    const lu = schema.safeParse(await reponse.json().catch(() => undefined));
    return lu.success ? { ok: true, valeur: lu.data } : { ok: false, code: 'inconnue' };
  }

  return {
    etat: () => appeler('GET', '/etat', undefined, EtatGestionSchema),
    creer: (creation) => appeler('POST', '/locations', creation, CreationReponseSchema),
    payer: (paiement) => appeler('POST', '/paiements', paiement, PaiementSchema),
    annulerPaiement: (id) =>
      appeler('DELETE', `/paiements/${encodeURIComponent(id)}`, undefined, z.undefined()),
    enregistrerPreferences: (preferences) =>
      appeler('PUT', '/preferences', preferences, PreferencesMenuSchema),
  };
}
