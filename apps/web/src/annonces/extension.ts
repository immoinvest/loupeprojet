import {
  MessageExtensionSchema,
  SOURCE_WEB,
  type MessageExtension,
  type MessageWeb,
  type ResultatLectureAuto,
} from '@loupe/capture';

/**
 * Dialogue avec l'extension Deklic depuis la page : `window.postMessage` sur la page elle-même,
 * écouté par le script « pont » de l'extension. Aucun serveur ; sans extension, personne ne répond.
 */
export interface FenetreDeklic {
  readonly location: { readonly origin: string };
  postMessage: (message: MessageWeb, origine: string) => void;
  addEventListener: (type: 'message', ecouteur: (evenement: MessageEvent) => void) => void;
  removeEventListener: (type: 'message', ecouteur: (evenement: MessageEvent) => void) => void;
}

/** Délai d'une lecture complète : chargement de l'annonce, essais cachés puis affichés. */
export const DELAI_LECTURE_MS = 90_000;
export const DELAI_PING_MS = 500;

let compteur = 0;
function identifiant(prefixe: string): string {
  compteur += 1;
  return `${prefixe}-${String(Date.now())}-${String(compteur)}`;
}

/**
 * Envoie un message à l'extension et attend la réponse qui porte le même identifiant, ou `null`
 * au bout du délai. Ignore tout ce qui ne vient pas de la page elle-même.
 */
function dialoguer(
  fenetre: FenetreDeklic,
  message: MessageWeb,
  delaiMs: number,
): Promise<MessageExtension | null> {
  return new Promise((resoudre) => {
    const ecouter = (evenement: MessageEvent): void => {
      if (evenement.source !== fenetre || evenement.origin !== fenetre.location.origin) return;
      const reponse = MessageExtensionSchema.safeParse(evenement.data);
      if (!reponse.success || reponse.data.id !== message.id) return;
      terminer(reponse.data);
    };
    const minuterie = setTimeout(() => {
      terminer(null);
    }, delaiMs);
    function terminer(reponse: MessageExtension | null): void {
      clearTimeout(minuterie);
      fenetre.removeEventListener('message', ecouter);
      resoudre(reponse);
    }
    fenetre.addEventListener('message', ecouter);
    fenetre.postMessage(message, fenetre.location.origin);
  });
}

/** L'extension est-elle installée et active sur cette page ? */
export async function detecterExtension(
  fenetre: FenetreDeklic,
  delaiMs = DELAI_PING_MS,
): Promise<boolean> {
  const reponse = await dialoguer(
    fenetre,
    { source: SOURCE_WEB, type: 'ping', id: identifiant('ping') },
    delaiMs,
  );
  return reponse?.type === 'pong';
}

/** Demande à l'extension de lire l'annonce ; un silence ou une réponse inattendue vaut échec de chargement. */
export async function lireParExtension(
  fenetre: FenetreDeklic,
  url: string,
  delaiMs = DELAI_LECTURE_MS,
): Promise<ResultatLectureAuto> {
  const reponse = await dialoguer(
    fenetre,
    { source: SOURCE_WEB, type: 'lire', id: identifiant('lire'), url },
    delaiMs,
  );
  return reponse?.type === 'resultat' ? reponse.resultat : { ok: false, raison: 'chargement' };
}
