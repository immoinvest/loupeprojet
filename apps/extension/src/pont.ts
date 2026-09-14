/**
 * Script « pont », chargé sur les pages Deklic (production, aperçus, localhost) dès le début du
 * chargement : il répond à la page qui cherche l'extension et relaie ses demandes de lecture vers
 * le service d'arrière-plan. Il ne lit rien de la page Deklic et n'écoute que la page elle-même.
 */
import {
  MessageWebSchema,
  ResultatLectureAutoSchema,
  SOURCE_EXTENSION,
  VERSION_PONT,
  type MessageExtension,
  type ResultatLectureAuto,
} from '@loupe/capture';

export type EnvoyerDemande = (demande: { type: 'deklic-lire'; url: string }) => Promise<unknown>;

interface Evenement {
  readonly data: unknown;
  readonly origin: string;
  readonly source: unknown;
}

const ECHEC: ResultatLectureAuto = { ok: false, raison: 'chargement' };

/** Traite un message reçu par la page Deklic ; ignore tout ce qui ne vient pas de la page elle-même. */
export async function traiterMessage(
  evenement: Evenement,
  fenetre: Window,
  envoyer: EnvoyerDemande,
): Promise<void> {
  if (evenement.source !== fenetre || evenement.origin !== fenetre.location.origin) return;
  const message = MessageWebSchema.safeParse(evenement.data);
  if (!message.success) return;
  const repondre = (reponse: MessageExtension): void => {
    fenetre.postMessage(reponse, fenetre.location.origin);
  };
  if (message.data.type === 'ping') {
    repondre({
      source: SOURCE_EXTENSION,
      type: 'pong',
      id: message.data.id,
      version: VERSION_PONT,
    });
    return;
  }
  let resultat = ECHEC;
  try {
    const lecture = ResultatLectureAutoSchema.safeParse(
      await envoyer({ type: 'deklic-lire', url: message.data.url }),
    );
    if (lecture.success) resultat = lecture.data;
  } catch {
    resultat = ECHEC;
  }
  repondre({ source: SOURCE_EXTENSION, type: 'resultat', id: message.data.id, resultat });
}

export function installerPont(fenetre: Window, envoyer: EnvoyerDemande): void {
  fenetre.addEventListener('message', (evenement) => {
    void traiterMessage(evenement, fenetre, envoyer);
  });
}

installerPont(window, (demande) => chrome.runtime.sendMessage(demande));
