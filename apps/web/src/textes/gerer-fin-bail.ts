import {
  REGULARISATION_CHARGES,
  RESTITUTION_DEPOT,
  SOLIDARITE_COLOCATAIRE,
  type ContenuRegularisation,
  type ContenuRestitution,
  type Majoration,
  type Preavis,
  type RaisonPreavis,
  type StatutLocation,
} from '@loupe/gestion';

import type { CodeErreurFinBail } from '@/gestion/fin-bail/types';
import { dateEnLettres, moisEnLettres, montant } from '@/gestion/format';

import { de } from './gerer-ecrans';

/** Textes de la fin du bail : préavis, dépôt de garantie, charges, colocataires (tutoiement). */

export const TEXTES_FIN_BAIL = {
  chargement: 'Chargement…',
  indisponible: 'Bientôt disponible : le préavis, le dépôt et les charges arrivent dans Gérer.',
  fermer: 'Fermer',
  enregistrer: 'Enregistrer',
} as const;

export const ERREURS_FIN_BAIL: Readonly<Record<CodeErreurFinBail, string>> = {
  non_connecte: 'Ta session a expiré. Reconnecte-toi.',
  invalide: 'Une information est invalide. Vérifie les champs.',
  introuvable: 'Cet élément n’existe plus. Recharge la page.',
  date_invalide: 'Cette date ne convient pas : elle est dans le futur, ou hors du bail.',
  conge_invalide: 'Un congé ne peut pas être reçu avant l’entrée du locataire.',
  fin_avant_entree: 'La sortie ne peut pas précéder l’entrée.',
  paiements_apres_sortie:
    'Des loyers sont déjà reçus pour des mois après cette sortie : annule-les d’abord.',
  location_en_cours: 'Le dépôt se rend après la sortie : enregistre d’abord le départ.',
  retenues_trop_elevees: 'Les retenues dépassent le dépôt de garantie.',
  deja_enregistre: 'C’est déjà enregistré. Recharge la page.',
  depot_rendu: 'Le dépôt est déjà rendu : le décompte ne s’annule plus.',
  regularisation_impossible: 'Rien à régulariser pour cette année. Recharge la page.',
  colocataire_refuse: 'Ce changement n’est pas possible à cette date.',
  bailleur_manquant: 'Indique d’abord ton nom et ton adresse de bailleur.',
  limite: 'Cette location a atteint dix colocataires.',
  indisponible: TEXTES_FIN_BAIL.indisponible,
  reseau: 'Impossible de joindre Deklic. Vérifie ta connexion internet.',
  inconnue: 'Quelque chose n’a pas marché. Réessaie.',
};

/* Préavis (G4-2) */

export const TEXTES_PREAVIS = {
  formulaire: 'Enregistrer un congé',
  recuLe: 'Congé reçu le',
  aideRecuLe: 'Le délai part du jour où tu as reçu la lettre, l’acte ou la remise en main propre.',
  reduit: 'Le locataire invoque un motif de préavis réduit',
  aideReduit:
    'Mutation, premier emploi, perte d’emploi, santé, violences, RSA ou AAH, logement social.',
  fin: 'Dernier jour du bail',
  aideFin: 'Calculé par Deklic, à corriger si vous vous êtes mis d’accord autrement.',
  enregistrer: 'Enregistrer le congé',
  modifier: 'Modifier le congé',
  annuler: 'Annuler le congé',
  erreurRecuLe: 'Indique la date de réception du congé.',
  erreurFin: 'La sortie ne peut pas précéder la réception du congé.',
  aConfirmer: 'Durée à confirmer.',
} as const;

const RAISONS: Readonly<Record<RaisonPreavis, string>> = {
  nue: 'location vide hors zone tendue',
  zone_inconnue: 'location vide ; zone tendue non renseignée, Deklic prend le délai le plus long',
  zone_tendue: 'location vide en zone tendue',
  motif_reduit: 'motif de préavis réduit',
  meublee: 'location meublée',
  mobilite: 'bail mobilité',
};

/** « Julie part » : le bouton qui ouvre le congé. */
export function departDe(prenom: string): string {
  return `${prenom} part`;
}

/** « Préavis de 3 mois (location vide hors zone tendue). » */
export function preavisEnLettres(preavis: Preavis): string {
  const mois = preavis.mois > 1 ? `${String(preavis.mois)} mois` : '1 mois';
  // Le préavis du bail mobilité vient d'une fiche Service-public, pas de l'article lui-même.
  const suite = preavis.raison === 'mobilite' ? ` ${TEXTES_PREAVIS.aConfirmer}` : '';
  return `Préavis de ${mois} (${RAISONS[preavis.raison]}).${suite}`;
}

export const STATUTS_LOCATION: Readonly<Record<StatutLocation, string>> = {
  a_venir: 'À venir',
  active: 'En cours',
  preavis: 'Préavis en cours',
  terminee: 'Terminée',
};

/** « Départ le 5 décembre 2026 ». */
export function departLe(fin: string): string {
  return `Départ le ${dateEnLettres(fin)}`;
}

/* Changement de colocataire (G4-6) */

export const TEXTES_COLOCATAIRE = {
  ouvrir: 'Changer de colocataire',
  formulaire: 'Changer de colocataire',
  qui: 'Qui part ?',
  personne: 'Personne ne part',
  dateDepart: 'Dernier jour dans le logement',
  arrivant: 'Prénom et nom du nouveau colocataire',
  aideArrivant: 'Laisse vide si personne n’arrive.',
  email: 'E-mail du nouveau colocataire',
  dateArrivee: 'Premier jour dans le logement',
  enregistrer: 'Enregistrer le changement',
  erreurSortant: 'Indique qui part, ou qui arrive.',
  erreurDate: 'Indique une date pendant le bail.',
  erreurArrivant: 'Indique le prénom et le nom, par exemple Hugo Petit.',
} as const;

/** « Les quittances de novembre 2026 porteront les nouveaux noms. » */
export function quittancesSuivantes(periode: string): string {
  return `Les quittances ${de(moisEnLettres(periode))} porteront les nouveaux noms.`;
}

/** « La solidarité de Julie prend fin le 10 mars 2027 (loi du 6 juillet 1989, article 8-1). » */
export function solidariteEnLettres(prenom: string, fin: string): string {
  return `La solidarité ${de(prenom)} prend fin le ${dateEnLettres(fin)} (${SOLIDARITE_COLOCATAIRE.source}).`;
}

/* Dépôt de garantie (G4-3) */

export const TEXTES_DEPOT = {
  titre: 'Dépôt de garantie',
  enCours: 'Le dépôt se rend après la sortie du locataire.',
  sansDepot: 'Aucun dépôt de garantie sur cette location.',
  conforme: 'État des lieux conforme',
  retenues: 'Retenues',
  formulaire: 'Retenues sur le dépôt',
  motif: 'Motif',
  montantRetenue: 'Montant',
  ajouterRetenue: 'Ajouter une retenue',
  clesLe: 'Clés remises le',
  enregistrerRetenues: 'Enregistrer les retenues',
  voirDecompte: 'Voir le décompte',
  marquerRendu: 'Marquer comme rendu',
  rendreLe: 'Rendu le',
  annuler: 'Annuler le décompte',
  erreurCles: 'Indique la date de remise des clés (au plus tard aujourd’hui).',
  erreurRetenues: 'Chaque retenue a un motif et un montant ; le total reste sous le dépôt.',
  source: `Loi du 6 juillet 1989, article 22 : ${String(RESTITUTION_DEPOT.conformeMois)} mois si l’état des lieux est conforme, ${String(RESTITUTION_DEPOT.retenuesMois)} mois sinon.`,
} as const;

/** « 1 300 € à rendre avant le 20 septembre 2026 ». */
export function aRendreAvant(aRendre: number, dateLimite: string): string {
  return `${montant(aRendre)} à rendre avant le ${dateEnLettres(dateLimite)}`;
}

/** « Rendre 1 300 € » : le bouton d'un état des lieux conforme. */
export function rendreTout(aRendre: number): string {
  return `${TEXTES_DEPOT.conforme} : rendre ${montant(aRendre)}`;
}

/** « En retard : 130 € de majoration (10 % du loyer par mois commencé). » */
export function majorationEnLettres(majoration: Majoration): string {
  const mois = majoration.moisCommences > 1 ? 'mois commencés' : 'mois commencé';
  return `En retard : ${montant(majoration.montant)} de majoration (${String(RESTITUTION_DEPOT.majorationPourcent)} % du loyer par mois, ${String(majoration.moisCommences)} ${mois}).`;
}

/** La ligne « À faire » : « Rendre le dépôt de Julie avant le 20 septembre 2026 ». */
export function depotAFaire(prenom: string, dateLimite: string): string {
  return `Rendre le dépôt ${de(prenom)} avant le ${dateEnLettres(dateLimite)}`;
}

/* Régularisation des charges (G4-4) */

export const TEXTES_CHARGES = {
  titre: 'Charges',
  provisions: 'Provisions versées',
  reelles: 'Charges récupérables',
  quotePart: 'Quote-part de la location',
  valider: 'Valider la régularisation',
  forfait: 'Charges au forfait : pas de régularisation (loi du 6 juillet 1989, article 23).',
  passerAuForfait: 'Passer au forfait',
  passerAuxProvisions: 'Passer aux provisions',
  sansDepense: 'Ajoute d’abord les dépenses récupérables de l’année dans Argent.',
  rienARegulariser: 'Rien à régulariser pour l’instant.',
  marquerReglee: 'Marquer comme réglée',
  regleeLe: 'Réglée le',
  source: `Décompte par nature envoyé un mois avant ; justificatifs tenus à disposition ${String(REGULARISATION_CHARGES.justificatifsMois)} mois (article 23).`,
} as const;

/** « Charges 2025 : 60 € à rembourser à Julie » ou « … 60 € à demander à Julie ». */
export function soldeEnLettres(annee: number, solde: number, prenom: string): string {
  const sens = solde < 0 ? `à rembourser ${de(prenom)}` : `à demander ${de(prenom)}`;
  return `Charges ${String(annee)} : ${montant(Math.abs(solde))} ${sens}`;
}

/** « À régler en juin 2027 ». */
export function echeanceEnLettres(periode: string): string {
  return `À régler ${de(moisEnLettres(periode))}`;
}

/* Décomptes imprimables (G4-3, G4-4) */

export const TEXTES_DECOMPTE = {
  restitution: 'Décompte du dépôt de garantie',
  regularisation: 'Décompte de régularisation des charges',
  bailleur: 'Bailleur',
  logement: 'Logement loué',
  entree: 'Entrée',
  sortie: 'Sortie',
  clesLe: 'Clés remises le',
  depot: 'Dépôt de garantie versé',
  totalRetenues: 'Total des retenues',
  aRendre: 'Somme restituée',
  dateLimite: 'À restituer au plus tard le',
  etatDesLieux: 'État des lieux de sortie',
  conforme: 'Conforme à l’état des lieux d’entrée',
  nonConforme: 'Non conforme',
  periode: 'Période',
  provisions: 'Provisions versées',
  charges: 'Charges récupérables',
  total: 'Total',
  solde: 'Solde',
  aRembourser: 'À rembourser au locataire',
  aDemander: 'À demander au locataire',
  quotePart: 'Quote-part',
  imprimer: 'Imprimer ou enregistrer en PDF',
  apercu:
    'Aperçu du décompte. Dans la fenêtre d’impression, choisissez « Enregistrer au format PDF ».',
  chargement: 'Chargement du décompte…',
  introuvable: 'Décompte introuvable',
  introuvableTexte: 'Ce décompte n’existe pas, ou il appartient à un autre compte.',
  numero: 'N°',
  sourceDepot:
    'Restitution du dépôt de garantie : loi n° 89-462 du 6 juillet 1989, article 22. Au-delà du délai, le dépôt restant dû est majoré de 10 % du loyer mensuel en principal par mois de retard commencé.',
  sourceCharges:
    'Régularisation annuelle des charges : loi n° 89-462 du 6 juillet 1989, article 23. Les pièces justificatives sont tenues à votre disposition pendant six mois.',
} as const;

/** « du 1er janvier 2026 au 31 décembre 2026 ». */
export function periodeEnLettres(debut: string, fin: string): string {
  return `du ${dateEnLettres(debut)} au ${dateEnLettres(fin)}`;
}

/** « 92 jours occupés sur 365, 1 chambre ». */
export function quotePartEnLettres(c: ContenuRegularisation): string {
  const chambres =
    c.chambres > 1 ? `, ${String(c.chambres)} chambres louées` : ', bien loué en entier';
  return `${String(c.joursOccupes)} jours occupés sur ${String(c.joursAnnee)}${chambres}`;
}

/** Le titre d'un décompte, selon son type. */
export function titreDecompte(
  type: ContenuRestitution['type'] | ContenuRegularisation['type'],
): string {
  return type === 'restitution' ? TEXTES_DECOMPTE.restitution : TEXTES_DECOMPTE.regularisation;
}
