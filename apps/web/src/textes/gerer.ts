import type { CodeErreurGestion } from '@/gestion/types';

/** Textes du menu à deux sections (barre latérale). */
export const TEXTES_MENU = {
  analyser: 'Analyser',
  gerer: 'Gérer',
  nouveauProjet: 'Nouveau projet',
  comparer: 'Comparer',
  ajouterBien: 'Ajouter un bien',
  accueil: 'Accueil',
  loyers: 'Loyers',
  gererSansCompte: 'Gérer mes biens loués',
} as const;

/** Au-delà de ce nombre, les projets les plus anciens passent derrière « Tous mes projets ». */
export const PROJETS_DANS_LE_MENU = 5;

export function tousMesProjets(nombre: number): string {
  return `Tous mes projets · ${String(nombre)}`;
}

/** « 1 loyer en retard », « 3 loyers en retard ». */
export function loyersEnRetard(nombre: number): string {
  return nombre > 1 ? `${String(nombre)} loyers en retard` : `${String(nombre)} loyer en retard`;
}

/** Carte « Mon menu » de la page Mon compte (vouvoiement, comme le reste de la page). */
export const TEXTES_MON_MENU = {
  titre: 'Mon menu',
  phrase: 'Choisissez ce que Deklic vous montre.',
  analyser: 'Analyser',
  analyserDetail: 'Des projets à étudier avant d’acheter.',
  gerer: 'Gérer',
  gererDetail: 'Vos biens loués, vos loyers, vos quittances.',
  auMoinsUne: 'Au moins une section reste affichée. Le réglage vous suit sur tous vos appareils.',
  chargement: 'Chargement de votre menu…',
} as const;

/** Carte « Mes données de gestion » de la page Mon compte (vouvoiement). */
export const TEXTES_EXPORT = {
  titre: 'Mes données de gestion',
  phrase:
    'Vos biens, locataires, loyers, quittances et reçus, dans un fichier JSON que vous gardez où vous voulez.',
  exporter: 'Exporter',
} as const;

/** Une phrase par code d'erreur de la gestion : courte, et qui dit quoi faire. */
export const ERREURS_GESTION: Readonly<Record<CodeErreurGestion, string>> = {
  non_connecte: 'Votre session a expiré. Reconnectez-vous.',
  invalide: 'Une information est incomplète ou invalide. Vérifiez les champs.',
  introuvable: 'Cet élément n’existe plus. Rechargez la page.',
  montant_depasse: 'Ce montant dépasse ce qui reste dû pour ce mois.',
  date_invalide: 'La date du paiement ne peut pas être dans le futur.',
  document_emis: 'Une quittance ou un reçu atteste ce paiement : il ne peut plus être annulé.',
  bailleur_manquant: 'Indiquez d’abord votre nom et votre adresse de bailleur.',
  loyer_non_regle: 'Ce loyer n’est pas encore entièrement reçu : pas de quittance pour l’instant.',
  loyer_regle: 'Ce paiement solde le mois : c’est la quittance qui l’atteste.',
  bien_occupe: 'Ce bien (ou cette chambre) est déjà loué à ces dates.',
  fin_avant_entree: 'La sortie ne peut pas précéder l’entrée.',
  paiements_apres_sortie:
    'Des loyers sont déjà reçus pour des mois après cette sortie : annulez-les d’abord.',
  limite: 'Ce compte a atteint le nombre maximal de biens (200).',
  indisponible: 'Gérer n’est pas disponible pour le moment. Réessayez dans quelques minutes.',
  reseau: 'Impossible de joindre Deklic. Vérifiez votre connexion internet.',
  inconnue: 'Quelque chose n’a pas marché. Réessayez.',
};
