import type { CategorieDepense, Depense } from '@loupe/gestion';

import type { Vue } from '@/gestion/argent/page';
import type { ChampDepense, ChoixFrequence } from '@/gestion/argent/saisie-depense';
import type { ChampPretBien } from '@/gestion/argent/saisie-pret';
import type { CodeErreurArgent } from '@/gestion/argent/types';
import { dateEnLettres, moisEnLettres, montant } from '@/gestion/format';

/** Textes des dépenses, du prêt d'un bien et de la page Argent (tutoiement, comme Gérer). */

export const CATEGORIES_TEXTE: Readonly<Record<CategorieDepense, string>> = {
  credit: 'Crédit',
  taxe_fonciere: 'Taxe foncière',
  copropriete: 'Copropriété',
  assurance: 'Assurance',
  travaux: 'Travaux',
  entretien: 'Entretien',
  gestion: 'Gestion et comptable',
  autre: 'Autre',
};

export const FREQUENCES_TEXTE: Readonly<Record<ChoixFrequence, string>> = {
  aucune: 'Une seule fois',
  mensuelle: 'Tous les mois',
  trimestrielle: 'Tous les trois mois',
  annuelle: 'Tous les ans',
};

export const TEXTES_ARGENT = {
  titre: 'Argent',
  vue: 'Afficher',
  unMois: 'Un mois',
  uneAnnee: 'Une année',
  mois: 'Mois',
  annee: 'Année',
  bien: 'Bien',
  tousLesBiens: 'Tous les biens',
  loyers: 'Loyers encaissés',
  depenses: 'Dépenses',
  mensualites: 'Mensualités de prêt',
  cashflow: 'Cash-flow réel',
  aucuneDepense: 'Aucune dépense sur cette période.',
  ajouterDepense: 'Ajouter une dépense',
  courbe: 'Cash-flow des 12 derniers mois',
  parBien: 'Par bien',
  depensesDeLaPeriode: 'Les dépenses de la période',
  commune: 'Dépense commune',
  explication:
    'Un loyer compte le jour où il est encaissé ; une dépense qui revient compte à chaque échéance.',
  bientot: 'Bientôt disponible',
  bientotTexte:
    'Le suivi des dépenses et du cash-flow arrive dans quelques jours. Tes loyers et tes quittances marchent déjà.',
  reessayer: 'Réessayer',
  chargement: 'Chargement…',
  modifier: 'Modifier',
  carteTitre: 'Argent de ce bien',
  ceMois: 'Ce mois-ci',
  douzeMois: 'Sur 12 mois',
  voirDetail: 'Voir le détail',
} as const;

export const TEXTES_DEPENSE = {
  nouvelle: 'Nouvelle dépense',
  modifier: 'Modifier la dépense',
  montant: 'Montant',
  categorie: 'Catégorie',
  bien: 'Bien',
  aucunBien: 'Aucun bien (dépense commune)',
  date: 'Date',
  libelle: 'Libellé (facultatif)',
  recuperable: 'Récupérable sur le locataire',
  recuperableAide: 'Une charge que tu refactures au locataire (eau, ordures ménagères…).',
  frequence: 'Revient',
  jusquAu: 'Jusqu’au (facultatif)',
  enregistrer: 'Enregistrer',
  annuler: 'Annuler',
  supprimer: 'Supprimer cette dépense',
  confirmerTitre: 'Supprimer cette dépense ?',
  confirmerTexte: 'Elle disparaît du calcul de toutes les périodes, pour de bon.',
  supprimerDefinitivement: 'Supprimer définitivement',
  introuvable: 'Cette dépense n’existe plus.',
  voirArgent: 'Voir l’argent de tes biens',
} as const;

export const ERREURS_DEPENSE: Readonly<Record<ChampDepense, string>> = {
  montant: 'Indique un montant en euros, par exemple 840.',
  date: 'Indique la date de la dépense.',
  libelle: '80 caractères au plus.',
  jusquAu: 'Une date après la première dépense, ou laisse vide.',
};

export const TEXTES_PRET = {
  titre: 'Le prêt',
  formulaire: 'Le prêt du bien',
  aucun: 'Aucun prêt enregistré pour ce bien.',
  ajouter: 'Ajouter le prêt',
  enregistrerPropose: 'Enregistrer ce prêt',
  ajuster: 'Ajuster avant',
  capital: 'Montant emprunté',
  taux: 'Taux nominal',
  duree: 'Durée',
  premiereEcheance: 'Première échéance',
  premiereEcheanceAide: 'Le mois et l’année, par exemple 11/2026.',
  assurance: 'Assurance par mois',
  enregistrer: 'Enregistrer le prêt',
  fermer: 'Fermer',
  modifier: 'Modifier le prêt',
  retirer: 'Retirer le prêt',
  mensualite: 'Mensualité, assurance comprise',
  restantDu: 'Capital restant dû',
  fin: 'Dernière échéance',
  doubleCompte:
    'Ne saisis pas aussi cette mensualité en dépense « Crédit » : elle serait comptée deux fois.',
} as const;

export const ERREURS_PRET: Readonly<Record<ChampPretBien, string>> = {
  capital: 'Indique le montant emprunté en euros, par exemple 150000.',
  taux: 'Un taux entre 0 et 20 %, par exemple 3,35.',
  duree: 'Une durée en années, par exemple 25 (40 ans au plus).',
  premiereEcheance: 'Le mois de la première échéance, par exemple 11/2026.',
  assurance: 'Une assurance en euros par mois, ou laisse vide.',
};

export const ERREURS_ARGENT: Readonly<Record<CodeErreurArgent, string>> = {
  non_connecte: 'Ta session a expiré. Reconnecte-toi.',
  invalide: 'Une information est incomplète ou invalide. Vérifie les champs.',
  introuvable: 'Cet élément n’existe plus. Recharge la page.',
  limite: 'Tu as atteint 2 000 dépenses : supprime les plus anciennes.',
  indisponible: 'Le suivi de l’argent n’est pas disponible pour le moment.',
  reseau: 'Impossible de joindre Deklic. Vérifie ta connexion internet.',
  inconnue: 'Quelque chose n’a pas marché. Réessaie.',
};

/** 41 200 → « +412 € » ; −3 200 → « −32 € » (signe moins typographique) ; 0 → « 0 € ». */
export function montantSigne(centimes: number): string {
  if (centimes === 0) return montant(0);
  return `${centimes > 0 ? '+' : '−'}${montant(Math.abs(centimes))}`;
}

/** « octobre 2026 » ou « 2026 ». */
export function nomDeLaVue(vue: Vue): string {
  return vue.type === 'mois' ? moisEnLettres(vue.periode) : String(vue.annee);
}

/** La phrase en tête de la page : ce que les biens ont rapporté (ou coûté) après crédit. */
export function phraseArgent(vue: Vue, cashflow: number): string {
  const quand = `En ${nomDeLaVue(vue)}`;
  if (cashflow === 0) return `${quand}, tes biens ne t’ont rien rapporté ni coûté après crédit.`;
  const verbe = cashflow > 0 ? 'rapporté' : 'coûté';
  return `${quand}, tes biens t’ont ${verbe} ${montant(Math.abs(cashflow))} après crédit.`;
}

/** 0,0335 → « 3,35 % ». */
export function pourcentage(taux: number): string {
  return `${String(Number((taux * 100).toFixed(3))).replace('.', ',')} %`;
}

/** 300 → « 25 ans » ; 210 → « 17 ans et 6 mois » ; 8 → « 8 mois » ; 12 → « 1 an ». */
export function dureeEnLettres(mois: number): string {
  const annees = Math.floor(mois / 12);
  const reste = mois % 12;
  const partAnnees = annees === 0 ? '' : `${String(annees)} an${annees > 1 ? 's' : ''}`;
  const partMois = reste === 0 ? '' : `${String(reste)} mois`;
  return [partAnnees, partMois].filter((p) => p !== '').join(' et ');
}

/** « 150 000 € à 3,35 % sur 25 ans ». */
export function conditionsDuPret(capital: number, taux: number, dureeMois: number): string {
  return `${montant(capital)} à ${pourcentage(taux)} sur ${dureeEnLettres(dureeMois)}`;
}

/** « L’analyse prévoyait 150 000 € à 3,35 % sur 25 ans. » */
export function pretPropose(capital: number, taux: number, dureeMois: number): string {
  return `L’analyse prévoyait ${conditionsDuPret(capital, taux, dureeMois)}.`;
}

const MOIS_COURT = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });

/** « 2026-10 » → « oct. » : sous chaque barre de la courbe. */
export function moisCourt(periode: string): string {
  return MOIS_COURT.format(new Date(`${periode}-01T00:00:00Z`));
}

/** La ligne de « À faire » : « Enregistrer le prêt de T2 Lices ». */
export function enregistrerLePretDe(nom: string): string {
  return `Enregistrer le prêt de ${nom}`;
}

/** Sous une dépense : « Tous les mois », « Tous les ans jusqu’au 14 octobre 2027 », ou rien. */
export function recurrenceEnLettres(depense: Pick<Depense, 'recurrence'>): string {
  const { recurrence } = depense;
  if (recurrence === undefined) return '';
  const frequence = FREQUENCES_TEXTE[recurrence.frequence];
  return recurrence.jusquAu === undefined
    ? frequence
    : `${frequence} jusqu’au ${dateEnLettres(recurrence.jusquAu)}`;
}

/** Nom accessible d'un montant lié à la fiche d'un bien : « Loyers encaissés de T2 Lices : 700 € ». */
export function montantDuBien(libelle: string, bien: string, valeur: string): string {
  return `${libelle} de ${bien} : ${valeur}`;
}
