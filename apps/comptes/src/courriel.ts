import type { Journal } from './journal';

/** Une pièce jointe : contenu en base64 (la quittance en PDF). */
export interface PieceJointe {
  readonly nom: string;
  readonly type: string;
  readonly base64: string;
}

export interface Message {
  /** Destinataire. Jamais journalisé. */
  readonly a: string;
  readonly sujet: string;
  readonly texte: string;
  readonly html: string;
  readonly pieces?: readonly PieceJointe[];
  /** Adresse de réponse (celle du bailleur pour un e-mail au locataire). Jamais journalisée. */
  readonly repondreA?: string;
}

/** L'envoyeur partagé par les codes de connexion et les envois de Gérer. */
export interface Envoyeur {
  envoyer(message: Message): Promise<void>;
  /** `journal` : développement, rien ne part (l'écran le dit). Absent : un vrai envoi. */
  readonly mode?: 'journal';
}

export type EnvoyeurCourriel = Envoyeur;

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/** Resend a refusé ou n'a pas répondu ; le statut suffit, jamais le corps (il pourrait citer l'adresse). */
export class ErreurCourriel extends Error {
  /** Statut HTTP de Resend, 0 sans réponse. */
  readonly statut: number;

  constructor(message: string, statut = 0) {
    super(message);
    this.name = 'ErreurCourriel';
    this.statut = statut;
  }
}

export const URL_RESEND = 'https://api.resend.com/emails';

/** Resend : POST /emails, clé en Bearer. Sans domaine vérifié, Resend ne livre qu'au propriétaire du compte. */
export function envoyeurResend(
  cle: string,
  expediteur: string,
  fetcher: Fetcher = (url, init) => fetch(url, init),
): Envoyeur {
  return {
    async envoyer(message) {
      const reponse = await fetcher(URL_RESEND, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: expediteur,
          to: [message.a],
          subject: message.sujet,
          text: message.texte,
          html: message.html,
          ...(message.repondreA === undefined ? {} : { reply_to: message.repondreA }),
          ...(message.pieces === undefined
            ? {}
            : {
                attachments: message.pieces.map((p) => ({
                  filename: p.nom,
                  content: p.base64,
                  content_type: p.type,
                })),
              }),
        }),
      }).catch(() => {
        throw new ErreurCourriel('Resend injoignable');
      });
      if (!reponse.ok) {
        throw new ErreurCourriel(`Resend a répondu ${String(reponse.status)}`, reponse.status);
      }
    },
  };
}

/**
 * Développement : le message est écrit dans le journal au lieu d'être envoyé (sans le destinataire ni
 * les pièces jointes). Le texte reste lisible pour suivre un lien d'accord : jamais hors dev.
 */
export function envoyeurJournal(journal: Journal): Envoyeur {
  return {
    mode: 'journal',
    envoyer(message) {
      journal.info('courriel.dev', {
        sujet: message.sujet,
        texte: message.texte,
        ...(message.pieces === undefined ? {} : { pieces: message.pieces.length }),
      });
      return Promise.resolve();
    },
  };
}

export const DUREE_CODE_MINUTES = 10;

/** Le courriel du code de connexion, en français, lisible sans HTML. */
export function messageCode(code: string): Omit<Message, 'a'> {
  const sujet = `${code} est votre code Deklic`;
  const texte = [
    `Votre code de connexion Deklic : ${code}`,
    '',
    `Il est valable ${String(DUREE_CODE_MINUTES)} minutes. Si vous n'avez rien demandé, ignorez ce message.`,
  ].join('\n');
  const html = [
    '<div style="font-family:system-ui,sans-serif;color:#23272f;max-width:32em">',
    '<p>Votre code de connexion Deklic :</p>',
    `<p style="font-size:32px;font-weight:700;letter-spacing:0.25em">${code}</p>`,
    `<p style="color:#6b7280">Il est valable ${String(DUREE_CODE_MINUTES)} minutes. Si vous n'avez rien demandé, ignorez ce message.</p>`,
    '</div>',
  ].join('');
  return { sujet, texte, html };
}
