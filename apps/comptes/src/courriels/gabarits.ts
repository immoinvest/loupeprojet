import { REGLES_ENVOIS, type ContenuDocument } from '@loupe/gestion';

import type { Message } from '../courriel';
import { logementEnLettres, numeroEnLettres } from './document';
import { deMois, montant, moisEnLettres } from './format';

/*
 * Les e-mails de Gérer adressés au locataire : vouvoiement, lisibles sans HTML, toute donnée saisie
 * échappée dans le HTML. Testés par instantané (tests/courriels-gabarits.test.ts).
 */

const CADRE = 'font-family:system-ui,sans-serif;color:#23272f;max-width:36em;line-height:1.5';
const DISCRET = 'color:#6b7280;font-size:14px';
const BOUTON =
  'display:inline-block;background:#4338ca;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px';
const PIED = 'Deklic, pour le compte de votre bailleur.';

export function echapperHtml(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function html(paragraphes: readonly string[]): string {
  return [`<div style="${CADRE}">`, ...paragraphes, '</div>'].join('');
}

export interface Invitation {
  readonly prenom: string;
  /** Le nom du bailleur, s'il est connu. */
  readonly bailleur: string | null;
  /** « T2 Lices, 12 rue des Lices », s'il est connu. */
  readonly logement: string | null;
  /** La page de confirmation : `<origine>/accord#<jeton>`. */
  readonly lien: string;
}

export const SUJET_INVITATION = 'Vos quittances de loyer par e-mail';
export const BOUTON_INVITATION = 'Oui, recevoir mes quittances par e-mail';

/** G2-1 : la demande d'accord exprès (loi n° 89-462 du 6 juillet 1989, art. 21). */
export function messageInvitation(invitation: Invitation): Omit<Message, 'a'> {
  const qui = invitation.bailleur ?? 'Votre bailleur';
  const pour = invitation.logement === null ? '' : ` pour le logement ${invitation.logement}`;
  const proposition = `${qui} vous propose de recevoir vos quittances de loyer par e-mail${pour}.`;
  const validite = `Le lien est valable ${String(REGLES_ENVOIS.dureeJetonJours)} jours. Sans réponse, rien ne change : vos quittances restent disponibles auprès de votre bailleur.`;
  const loi =
    'La loi prévoit l’envoi par e-mail seulement avec votre accord, et la quittance est toujours gratuite (loi du 6 juillet 1989, article 21).';
  const texte = [
    `Bonjour ${invitation.prenom},`,
    '',
    proposition,
    '',
    `Pour accepter, ouvrez ce lien puis confirmez : ${invitation.lien}`,
    '',
    validite,
    loi,
    '',
    PIED,
  ].join('\n');
  return {
    sujet: SUJET_INVITATION,
    texte,
    html: html([
      `<p>Bonjour ${echapperHtml(invitation.prenom)},</p>`,
      `<p>${echapperHtml(proposition)}</p>`,
      `<p><a href="${echapperHtml(invitation.lien)}" style="${BOUTON}">${BOUTON_INVITATION}</a></p>`,
      `<p style="${DISCRET}">${echapperHtml(validite)} ${echapperHtml(loi)}</p>`,
      `<p style="${DISCRET}">${PIED}</p>`,
    ]),
  };
}

/** « Votre quittance de loyer – octobre 2026 ». */
export function sujetQuittance(periode: string): string {
  return `Votre quittance de loyer – ${moisEnLettres(periode)}`;
}

/** « quittance-2026-10-Q-202610-3F9A2C1B.pdf ». */
export function nomFichierQuittance(contenu: ContenuDocument): string {
  return `quittance-${contenu.periode}-${contenu.numero}.pdf`;
}

/** G2-2 : la quittance d'un loyer entièrement reçu, PDF joint par l'appelant. */
export function messageQuittance(prenom: string, contenu: ContenuDocument): Omit<Message, 'a'> {
  const phrase = `Vous trouverez ci-joint la quittance de loyer ${deMois(contenu.periode)} (${montant(contenu.total)}) pour le logement ${logementEnLettres(contenu.logement)}, établie par ${contenu.bailleur.nom}.`;
  const numero = `${numeroEnLettres(contenu.numero)}.`;
  const pourquoi =
    'Vous recevez ce message parce que vous avez accepté de recevoir vos quittances par e-mail. Pour ne plus les recevoir, répondez à ce message.';
  return {
    sujet: sujetQuittance(contenu.periode),
    texte: [`Bonjour ${prenom},`, '', phrase, numero, '', pourquoi, '', PIED].join('\n'),
    html: html([
      `<p>Bonjour ${echapperHtml(prenom)},</p>`,
      `<p>${echapperHtml(phrase)}<br>${echapperHtml(numero)}</p>`,
      `<p style="${DISCRET}">${pourquoi}</p>`,
      `<p style="${DISCRET}">${PIED}</p>`,
    ]),
  };
}
