import {
  capturer,
  creerRegistre,
  resoudreAnnonce,
  urlDeCapture,
  type Registre,
} from '@loupe/capture';
import bienici from '@loupe/extension/regles/bienici.json';
import leboncoin from '@loupe/extension/regles/leboncoin.json';
import logicimmo from '@loupe/extension/regles/logicimmo.json';
import pap from '@loupe/extension/regles/pap.json';
import seloger from '@loupe/extension/regles/seloger.json';

/** Les mêmes règles que l'extension, figées dans le bouton-favori au moment du build du web. */
export const REGISTRE_FAVORI: Registre = creerRegistre([
  leboncoin,
  seloger,
  bienici,
  pap,
  logicimmo,
]);

/** Ce dont le bouton-favori a besoin de la fenêtre du portail : rien de plus, pour rester testable. */
export interface FenetrePortail {
  readonly location: { readonly href: string; assign: (url: string) => void };
  readonly open: (url: string, cible: string) => unknown;
  readonly alert: (message: string) => void;
}

export type IssueFavori = 'hors-annonce' | 'sans-regles' | 'ouverte';

export const MESSAGE_HORS_ANNONCE =
  "Deklic : ouvrez une annonce LeBonCoin, SeLoger, Bien'ici, PAP ou Logic-Immo, puis cliquez sur le favori.";
export const MESSAGE_SANS_REGLES =
  "Deklic ne sait pas encore lire ce portail. Collez le texte de l'annonce dans Deklic, ça marche aussi.";

/**
 * Cœur du bouton-favori : lit la page ouverte avec les règles de son portail et ouvre Deklic avec la
 * capture dans le fragment d'URL. Aucune requête réseau ; si l'ouverture d'un onglet est bloquée,
 * la page courante navigue vers Loupe.
 */
export function lancerCapture(
  document: Document,
  fenetre: FenetrePortail,
  base: string,
  registre: Registre = REGISTRE_FAVORI,
): IssueFavori {
  const href = fenetre.location.href;
  const annonce = resoudreAnnonce(href);
  if (annonce === null) {
    fenetre.alert(MESSAGE_HORS_ANNONCE);
    return 'hors-annonce';
  }
  const regles = registre.reglesDuPortail(annonce.portail);
  const capture =
    regles === undefined ? null : capturer(document, href, regles, { mode: 'bookmarklet' });
  if (capture === null) {
    fenetre.alert(MESSAGE_SANS_REGLES);
    return 'sans-regles';
  }
  const url = urlDeCapture(base, capture);
  if (fenetre.open(url, '_blank') === null) fenetre.location.assign(url);
  return 'ouverte';
}
