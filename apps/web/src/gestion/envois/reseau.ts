import {
  AccordLocataireSchema,
  ContactLocataireSchema,
  EnvoiSchema,
  EtatEnvoisSchema,
  LectureAccordSchema,
  SaisieBailleurBienSchema,
} from '@loupe/gestion';
import { z } from 'zod';

import type { ClientAccord, ClientEnvois, CodeErreurEnvois, ResultatEnvois } from './types';

export type Recuperateur = (url: string, init?: RequestInit) => Promise<Response>;

const ErreurSchema = z.object({ code: z.string() });

const CODES_SERVEUR: Readonly<Record<string, CodeErreurEnvois>> = {
  ENVOIS_INDISPONIBLE: 'indisponible',
  GESTION_INDISPONIBLE: 'indisponible',
  ENVOIS_INACTIFS: 'inactifs',
  SANS_EMAIL: 'sans_email',
  SANS_ACCORD: 'sans_accord',
  ENVOI_RECENT: 'envoi_recent',
  INVITATION_RECENTE: 'invitation_recente',
  ENVOI_ECHOUE: 'envoi_echoue',
  LIEN_INVALIDE: 'lien_invalide',
  INTROUVABLE: 'introuvable',
  CHAMPS_INVALIDES: 'invalide',
  CORPS_TROP_GROS: 'invalide',
  NON_CONNECTE: 'non_connecte',
};

async function codeDe(reponse: Response): Promise<CodeErreurEnvois> {
  const corps = ErreurSchema.safeParse(await reponse.json().catch(() => undefined));
  const connu = corps.success ? CODES_SERVEUR[corps.data.code] : undefined;
  if (connu !== undefined) return connu;
  return reponse.status >= 500 ? 'indisponible' : 'inconnue';
}

type Methode = 'GET' | 'POST' | 'PUT';

function appelant(recuperer: Recuperateur, racine: string) {
  return async function appeler<T>(
    methode: Methode,
    chemin: string,
    corps: unknown,
    schema: z.ZodType<T>,
  ): Promise<ResultatEnvois<T>> {
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
      reponse = await recuperer(`${racine}${chemin}`, init);
    } catch {
      return { ok: false, code: 'reseau' };
    }
    if (!reponse.ok) return { ok: false, code: await codeDe(reponse) };
    const lu = schema.safeParse(await reponse.json().catch(() => undefined));
    return lu.success ? { ok: true, valeur: lu.data } : { ok: false, code: 'inconnue' };
  };
}

const segment = encodeURIComponent;

/** L'API /api/gestion/envois du worker des comptes, même origine ; réponses revalidées par Zod. */
export function clientEnvoisReseau(
  recuperer: Recuperateur = (url, init) => fetch(url, init),
): ClientEnvois {
  const appeler = appelant(recuperer, '/api/gestion/envois');
  return {
    etat: () => appeler('GET', '', undefined, EtatEnvoisSchema),
    declarerAccord: (id) =>
      appeler('POST', `/locataires/${segment(id)}/accord`, {}, AccordLocataireSchema),
    inviter: (id) =>
      appeler('POST', `/locataires/${segment(id)}/invitation`, {}, AccordLocataireSchema),
    enregistrerContact: (id, telephone) =>
      appeler('PUT', `/locataires/${segment(id)}/contact`, { telephone }, ContactLocataireSchema),
    enregistrerBailleurBien: (bienId, bailleur) =>
      appeler('PUT', `/biens/${segment(bienId)}/bailleur`, { bailleur }, SaisieBailleurBienSchema),
    renvoyer: (documentId) =>
      appeler('POST', `/documents/${segment(documentId)}/renvoyer`, {}, z.array(EnvoiSchema)),
  };
}

/** L'API publique /api/accord : le jeton voyage dans le corps, jamais dans l'adresse (ADR-G41). */
export function clientAccordReseau(
  recuperer: Recuperateur = (url, init) => fetch(url, init),
): ClientAccord {
  const appeler = appelant(recuperer, '/api/accord');
  return {
    lire: (jeton) => appeler('POST', '/lire', { jeton }, LectureAccordSchema),
    repondre: (jeton, reponse) =>
      appeler(
        'POST',
        '/repondre',
        { jeton, reponse },
        z.object({ statut: z.enum(['accorde', 'refuse']) }),
      ),
  };
}
