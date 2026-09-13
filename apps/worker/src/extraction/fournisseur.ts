import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';

import type { Fetcher } from '../dependances';
import { ErreurAmontInvalide, messageDe, type CodeErreur } from '../erreurs';
import type { Journal } from '../journal';
import { messagesPour } from './prompt';

export const URL_OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';
/** Meilleur modèle gratuit d'OpenRouter avec sortie JSON au 13/09/2026 ; réglable par la variable LLM_MODELE. */
export const MODELE_DEFAUT = 'nvidia/nemotron-3-super-120b-a12b:free';
export const DELAI_LLM_MS = 25_000;

export type ReponseExtracteur =
  | { readonly ok: true; readonly brut: unknown }
  | { readonly ok: false; readonly statut: ContentfulStatusCode; readonly code: CodeErreur };

/** Le contrat d'un fournisseur de lecture : un texte entre, un objet JSON (non validé) sort. */
export interface Extracteur {
  readonly modele: string;
  extraire(texte: string): Promise<ReponseExtracteur>;
}

export interface ConfigurationChat {
  readonly url: string;
  readonly modele: string;
  readonly cle: string;
  readonly delaiMs: number;
}

/** Réponse « chat completions » (OpenAI, OpenRouter, Mistral) : seul le contenu du premier choix compte. */
const ChoixSchema = z.object({ message: z.object({ content: z.string().nullable() }) });
const ReponseChatSchema = z.object({ choices: z.tuple([ChoixSchema], ChoixSchema) });

/** Ce qu'on journalise d'une réponse inexploitable : sa forme, jamais son contenu. */
export function diagnostic(corps: unknown): Readonly<Record<string, unknown>> {
  if (corps === null || typeof corps !== 'object') return { type: typeof corps };
  const objet = corps as Record<string, unknown>;
  const resultat: Record<string, unknown> = { cles: Object.keys(objet).slice(0, 8) };
  const erreur = objet.error;
  if (erreur !== null && typeof erreur === 'object') {
    const e = erreur as Record<string, unknown>;
    resultat.erreur = {
      code: e.code,
      message: typeof e.message === 'string' ? e.message.slice(0, 200) : undefined,
    };
  }
  const choix = Array.isArray(objet.choices) ? objet.choices : [];
  resultat.choix = choix.length;
  const premier: unknown = choix[0];
  if (premier !== null && typeof premier === 'object') {
    const p = premier as Record<string, unknown>;
    const message = p.message;
    const m: Record<string, unknown> =
      message !== null && typeof message === 'object' ? (message as Record<string, unknown>) : {};
    resultat.fin = p.finish_reason;
    resultat.clesMessage = Object.keys(m);
    resultat.longueurContenu = typeof m.content === 'string' ? m.content.length : null;
  }
  return resultat;
}

/** Isole l'objet JSON dans la réponse d'un modèle : blocs de réflexion et clôtures de code retirés. */
export function extraireJson(contenu: string): unknown {
  const sansReflexion = contenu.replace(/<think>[\s\S]*?<\/think>/g, '');
  const debut = sansReflexion.indexOf('{');
  const fin = sansReflexion.lastIndexOf('}');
  if (debut === -1 || fin <= debut) {
    throw new ErreurAmontInvalide('aucun objet JSON dans la réponse du modèle');
  }
  try {
    return JSON.parse(sansReflexion.slice(debut, fin + 1)) as unknown;
  } catch (erreur) {
    throw new ErreurAmontInvalide(`JSON illisible : ${messageDe(erreur)}`);
  }
}

/** Fournisseur compatible « chat completions » : OpenRouter par défaut, Mistral direct en changeant l'URL. */
export function extracteurChat(
  config: ConfigurationChat,
  fetcher: Fetcher,
  journal: Journal,
): Extracteur {
  const url = new URL(config.url);
  return {
    modele: config.modele,
    async extraire(texte) {
      let reponse: Response;
      try {
        reponse = await fetcher(url, {
          method: 'POST',
          signal: AbortSignal.timeout(config.delaiMs),
          headers: {
            authorization: `Bearer ${config.cle}`,
            'content-type': 'application/json',
            'http-referer': 'https://loupeprojet.pages.dev',
            'x-title': 'Deklic',
          },
          body: JSON.stringify({
            model: config.modele,
            messages: messagesPour(texte),
            temperature: 0,
            max_tokens: 1200,
            response_format: { type: 'json_object' },
            // Les modèles « réfléchissants » dépensent leurs jetons à penser : on ne veut que le JSON.
            reasoning: { enabled: false, exclude: true },
          }),
        });
      } catch (erreur) {
        journal.erreur('llm.injoignable', { modele: config.modele, raison: messageDe(erreur) });
        return { ok: false, statut: 502, code: 'AMONT_INDISPONIBLE' };
      }
      if (reponse.status === 429) {
        journal.erreur('llm.sature', { modele: config.modele });
        return { ok: false, statut: 503, code: 'AMONT_SATURE' };
      }
      if (reponse.status === 401 || reponse.status === 403) {
        journal.erreur('llm.cle_refusee', { modele: config.modele, statutAmont: reponse.status });
        return { ok: false, statut: 503, code: 'EXTRACTION_INDISPONIBLE' };
      }
      if (!reponse.ok) {
        journal.erreur('llm.erreur', { modele: config.modele, statutAmont: reponse.status });
        return { ok: false, statut: 502, code: 'AMONT_INDISPONIBLE' };
      }
      let corps: unknown;
      try {
        corps = await reponse.json();
      } catch (erreur) {
        journal.erreur('llm.invalide', { modele: config.modele, raison: messageDe(erreur) });
        return { ok: false, statut: 502, code: 'AMONT_INVALIDE' };
      }
      try {
        const lecture = ReponseChatSchema.parse(corps);
        return { ok: true, brut: extraireJson(lecture.choices[0].message.content ?? '') };
      } catch (erreur) {
        journal.erreur('llm.invalide', {
          modele: config.modele,
          raison: messageDe(erreur),
          diagnostic: diagnostic(corps),
        });
        return { ok: false, statut: 502, code: 'AMONT_INVALIDE' };
      }
    },
  };
}
