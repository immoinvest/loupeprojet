import type { Envoi, LectureAccord, StatutAccordEffectif, TypeBailleur } from '@loupe/gestion';

import type { TonPastille } from '@/composants/ui';
import { dateEnLettres } from '@/gestion/format';
import type { CodeErreurEnvois } from '@/gestion/envois/types';

import { de } from './gerer-ecrans';

/** Textes des quittances envoyées par e-mail dans Gérer (tutoiement, comme le reste de Gérer). */
export const TEXTES_ENVOIS = {
  titreAccord: 'Quittances par e-mail',
  bientot: 'Bientôt disponible : l’envoi des quittances par e-mail arrive dans Deklic.',
  declarer: 'Mon locataire m’a déjà donné son accord',
  renvoyerDemande: 'Renvoyer la demande',
  demandeRenvoyee: 'Demande renvoyée.',
  accordNote: 'Accord noté : ses quittances partiront par e-mail.',
  modeJournal:
    'Mode développement : les e-mails sont écrits dans le journal du serveur, rien n’est envoyé.',
  inactifs:
    'Les envois par e-mail ne sont pas encore activés sur Deklic. Tu peux déjà noter l’accord de ton locataire.',
  loi: 'La loi demande son accord pour lui envoyer ses quittances par e-mail (loi du 6 juillet 1989, article 21).',
  telephone: 'Téléphone (facultatif)',
  telephoneInvalide: 'Ce numéro ne semble pas valide. Exemple : 06 12 34 56 78.',
  renvoyer: 'Renvoyer',
  quittancePartira: 'La quittance partira par e-mail dans quelques secondes.',
  bailleurTitre: 'Bailleur de ce bien',
  bailleurPhrase:
    'Si ce bien appartient à une SCI ou à un autre bailleur, ses quittances porteront ce nom et cette adresse. Les quittances déjà émises ne changent pas.',
  bailleurDuCompte: 'Les quittances de ce bien portent ton identité de bailleur.',
  bailleurAucun: 'Ton nom et ton adresse de bailleur seront demandés à la première quittance.',
  autreBailleur: 'Indiquer un autre bailleur',
  /** Jamais « Modifier » seul : la carte de la location a déjà un bouton de ce nom sur la fiche du bien. */
  modifierBailleur: 'Modifier le bailleur',
  revenirIdentite: 'Revenir à mon identité',
  formulaireBailleur: 'Bailleur de ce bien',
  typeBailleur: 'Le bailleur est',
  nomBailleur: 'Nom (ou raison sociale)',
  adresseBailleur: 'Adresse',
  nomInvalide: 'Indique le nom du bailleur.',
  adresseInvalide: 'Indique l’adresse du bailleur.',
  enregistrer: 'Enregistrer',
  annuler: 'Annuler',
} as const;

export const TYPES_BAILLEUR_TEXTES: Readonly<Record<TypeBailleur, string>> = {
  personne: 'Une personne',
  sci: 'Une SCI',
};

export const PASTILLES_ACCORD: Readonly<Record<StatutAccordEffectif, string>> = {
  sans_email: 'Sans e-mail',
  non_demande: 'Non demandé',
  en_attente: 'En attente',
  accorde: 'Accord donné',
  refuse: 'Refusé',
  declare_par_bailleur: 'Accord noté',
};

export const TONS_ACCORD: Readonly<Record<StatutAccordEffectif, TonPastille>> = {
  sans_email: 'neutre',
  non_demande: 'neutre',
  en_attente: 'surveiller',
  accorde: 'bon',
  refuse: 'neutre',
  declare_par_bailleur: 'bon',
};

export const PHRASES_ACCORD: Readonly<Record<StatutAccordEffectif, string>> = {
  sans_email: 'Ajoute son e-mail pour lui envoyer ses quittances.',
  non_demande: 'Sa réponse ne lui a pas encore été demandée.',
  en_attente: 'Une demande lui a été envoyée ; il suffit qu’il clique pour accepter.',
  accorde: 'Ses quittances partent par e-mail dès qu’un loyer est entièrement reçu.',
  refuse: 'Il préfère ne pas recevoir ses quittances par e-mail.',
  declare_par_bailleur: 'Ses quittances partent par e-mail dès qu’un loyer est entièrement reçu.',
};

/** « le 6 octobre 2026 » depuis un horodatage ISO. */
export function leJourDe(horodatage: string): string {
  return `le ${dateEnLettres(horodatage.slice(0, 10))}`;
}

/** « 06/10 ». */
function jourMois(horodatage: string): string {
  return `${horodatage.slice(8, 10)}/${horodatage.slice(5, 7)}`;
}

/** « Envoyée le 06/10 à julie@… », « Envoi à julie@… en échec ». */
export function traceEnvoi(envoi: Envoi): string {
  return envoi.statut === 'envoye'
    ? `Envoyée le ${jourMois(envoi.envoyeLe ?? envoi.dernierEssaiLe)} à ${envoi.destinataire}`
    : `Envoi à ${envoi.destinataire} en échec`;
}

/** « E-mail de Julie à vérifier ». */
export function emailAVerifierDe(prenom: string): string {
  return `E-mail ${de(prenom)} à vérifier`;
}

/** « Accord de Julie Martin pour les quittances par e-mail ». */
export function accordEnAttenteDe(nom: string): string {
  return `Accord ${de(nom)} pour les quittances par e-mail`;
}

/** « Renvoyer la quittance de Julie » : nom accessible du bouton « Renvoyer ». */
export function renvoyerLaQuittanceDe(prenom: string): string {
  return `Renvoyer la quittance ${de(prenom)}`;
}

export const ERREURS_ENVOIS: Readonly<Record<CodeErreurEnvois, string>> = {
  indisponible: TEXTES_ENVOIS.bientot,
  inactifs: 'Les envois par e-mail ne sont pas encore activés sur Deklic.',
  sans_email: 'Ajoute d’abord l’e-mail de ce locataire.',
  sans_accord: 'Aucun locataire de ce bail n’a encore accepté les quittances par e-mail.',
  envoi_recent: 'Cette quittance vient de partir. Réessaie dans une minute.',
  invitation_recente: 'Une demande est déjà partie il y a moins de 24 heures.',
  envoi_echoue: 'L’e-mail n’a pas pu partir. Vérifie l’adresse du locataire.',
  lien_invalide: 'Ce lien n’est plus valable.',
  introuvable: 'Cet élément n’existe plus. Recharge la page.',
  invalide: 'Une information est incomplète ou invalide. Vérifie les champs.',
  non_connecte: 'Ta session a expiré. Reconnecte-toi.',
  reseau: 'Impossible de joindre Deklic. Vérifie ta connexion internet.',
  inconnue: 'Quelque chose n’a pas marché. Réessaie.',
};

/** La page publique d'accord s'adresse au locataire : vouvoiement. */
export const TEXTES_ACCORD = {
  titre: 'Vos quittances de loyer par e-mail',
  chargement: 'Chargement…',
  oui: 'Oui, recevoir mes quittances par e-mail',
  non: 'Non merci',
  loi: 'La quittance reste gratuite, et vous pouvez changer d’avis à tout moment en le disant à votre bailleur (loi du 6 juillet 1989, article 21).',
  merciOui: 'C’est noté : vos prochaines quittances arriveront par e-mail.',
  merciNon: 'C’est noté : vos quittances ne vous seront pas envoyées par e-mail.',
  invalideTitre: 'Ce lien n’est plus valable',
  invalide:
    'Il a peut-être déjà servi ou expiré, ou votre adresse a changé. Demandez à votre bailleur de vous renvoyer la demande.',
  indisponible: 'Ce service n’est pas encore disponible. Réessayez un peu plus tard.',
  erreur: 'Quelque chose n’a pas marché. Vérifiez votre connexion et réessayez.',
  accueil: 'Découvrir Deklic',
} as const;

export function bonjour(prenom: string): string {
  return `Bonjour ${prenom},`;
}

/** « Pierre Georgel vous propose de recevoir vos quittances de loyer par e-mail pour le logement … ». */
export function propositionAccord(lecture: LectureAccord): string {
  const qui = lecture.bailleur ?? 'Votre bailleur';
  const pour = lecture.logement === null ? '' : ` pour le logement ${lecture.logement}`;
  return `${qui} vous propose de recevoir vos quittances de loyer par e-mail${pour}.`;
}
