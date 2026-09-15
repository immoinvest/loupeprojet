import {
  EtatBailSchema,
  LegalBienSchema,
  LettreRevisionCompleteSchema,
  RevisionAppliqueeSchema,
  RevisionLocationSchema,
} from '@loupe/gestion';
import { z } from 'zod';

import type { Recuperateur } from '../reseau';
import type { ClientBail, CodeErreurBail, ResultatBail } from './types';

const RACINE = '/api/gestion/bail';
const ErreurSchema = z.object({ code: z.string() });

const CODES_SERVEUR: Readonly<Record<string, CodeErreurBail>> = {
  NON_CONNECTE: 'non_connecte',
  CHAMPS_INVALIDES: 'invalide',
  CORPS_TROP_GROS: 'invalide',
  INTROUVABLE: 'introuvable',
  REVISION_IMPOSSIBLE: 'revision_impossible',
  BAILLEUR_MANQUANT: 'bailleur_manquant',
  PERIODE_PAYEE: 'periode_payee',
  HORS_LOCATION: 'hors_location',
  LIMITE_ATTEINTE: 'limite',
  BAIL_INDISPONIBLE: 'indisponible',
  GESTION_INDISPONIBLE: 'indisponible',
};

async function codeDe(reponse: Response): Promise<CodeErreurBail> {
  const corps = ErreurSchema.safeParse(await reponse.json().catch(() => undefined));
  const connu = corps.success ? CODES_SERVEUR[corps.data.code] : undefined;
  if (connu !== undefined) return connu;
  return reponse.status >= 500 ? 'indisponible' : 'inconnue';
}

/** Le client réel : /api/gestion/bail sur l'origine du site, réponses revalidées par Zod. */
export function clientBailReseau(
  recuperer: Recuperateur = (url, init) => fetch(url, init),
): ClientBail {
  async function appeler<T>(
    methode: 'GET' | 'PUT' | 'POST',
    chemin: string,
    corps: unknown,
    schema: z.ZodType<T>,
  ): Promise<ResultatBail<T>> {
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
  const id = encodeURIComponent;

  return {
    etat: () => appeler('GET', '', undefined, EtatBailSchema),
    enregistrerBien: (bienId, saisie) =>
      appeler('PUT', `/biens/${id(bienId)}`, saisie, LegalBienSchema),
    enregistrerRevision: (locationId, saisie) =>
      appeler('PUT', `/locations/${id(locationId)}/revision`, saisie, RevisionLocationSchema),
    // 201 pour une révision appliquée, 200 si la lettre existait déjà : même corps.
    appliquerRevision: (locationId, anniversaire) =>
      appeler(
        'POST',
        `/locations/${id(locationId)}/revision/appliquer`,
        { anniversaire },
        RevisionAppliqueeSchema,
      ),
    lettre: (lettreId) =>
      appeler('GET', `/lettres/${id(lettreId)}`, undefined, LettreRevisionCompleteSchema),
  };
}
