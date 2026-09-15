import { DepenseSchema, EtatArgentSchema, PretEnregistreSchema } from '@loupe/gestion';
import { z } from 'zod';

import type { Recuperateur } from '../reseau';
import type { ClientArgent, CodeErreurArgent, ResultatArgent } from './types';

const RACINE = '/api/gestion';
const ErreurSchema = z.object({ code: z.string() });

/** Codes de l'API (apps/comptes, sous-routeur argent) vers les codes de l'interface. */
const CODES_SERVEUR: Readonly<Record<string, CodeErreurArgent>> = {
  NON_CONNECTE: 'non_connecte',
  CHAMPS_INVALIDES: 'invalide',
  CORPS_TROP_GROS: 'invalide',
  INTROUVABLE: 'introuvable',
  LIMITE_ATTEINTE: 'limite',
  DEPENSES_INDISPONIBLE: 'indisponible',
  GESTION_INDISPONIBLE: 'indisponible',
};

async function codeDe(reponse: Response): Promise<CodeErreurArgent> {
  const corps = ErreurSchema.safeParse(await reponse.json().catch(() => undefined));
  const connu = corps.success ? CODES_SERVEUR[corps.data.code] : undefined;
  if (connu !== undefined) return connu;
  return reponse.status >= 500 ? 'indisponible' : 'inconnue';
}

type Methode = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Le client réel : /api/gestion sur l'origine du site, réponses revalidées par Zod. */
export function clientArgentReseau(
  recuperer: Recuperateur = (url, init) => fetch(url, init),
): ClientArgent {
  async function appeler<T>(
    methode: Methode,
    chemin: string,
    corps: unknown,
    schema: z.ZodType<T>,
  ): Promise<ResultatArgent<T>> {
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

  const depense = (id: string): string => `/depenses/${encodeURIComponent(id)}`;
  const pret = (bienId: string): string => `/biens/${encodeURIComponent(bienId)}/pret`;

  return {
    etat: () => appeler('GET', '/argent', undefined, EtatArgentSchema),
    ajouterDepense: (nouvelle) => appeler('POST', '/depenses', nouvelle, DepenseSchema),
    modifierDepense: (id, modifiee) => appeler('PATCH', depense(id), modifiee, DepenseSchema),
    supprimerDepense: (id) => appeler('DELETE', depense(id), undefined, z.undefined()),
    enregistrerPret: (bienId, p) => appeler('PUT', pret(bienId), p, PretEnregistreSchema),
    supprimerPret: (bienId) => appeler('DELETE', pret(bienId), undefined, z.undefined()),
  };
}
