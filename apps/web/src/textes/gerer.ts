import type { ChoixMenu } from '@/gestion/menu';
import type { CodeErreurGestion } from '@/gestion/types';

/** Textes du menu (barre latérale) : l'accueil, puis les sections Analyser et Gérer. */
export const TEXTES_MENU = {
  accueil: 'Accueil',
  analyser: 'Analyser',
  gerer: 'Gérer',
  nouveauProjet: 'Nouveau projet',
  ajouterBien: 'Ajouter un bien',
  loyersDuMois: 'Loyers du mois',
  gererSansCompte: 'Gérer mes biens loués',
} as const;

/** Les projets les plus récents montrés dans le menu ; tous les autres sont derrière « Tous mes projets ». */
export const PROJETS_DANS_LE_MENU = 3;

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
  phrase: 'Choisissez ce que Deklic vous montre, dans le menu et sur l’accueil.',
  chargement: 'Chargement de votre menu…',
} as const;

export const TEXTES_CHOIX_MENU: Readonly<
  Record<ChoixMenu, { readonly libelle: string; readonly detail: string }>
> = {
  les_deux: {
    libelle: 'Analyser et Gérer',
    detail: 'Étudier des projets avant d’acheter, et suivre vos biens loués.',
  },
  analyser: { libelle: 'Analyser seulement', detail: 'Des projets à étudier avant d’acheter.' },
  gerer: { libelle: 'Gérer seulement', detail: 'Vos biens loués, vos loyers, vos quittances.' },
};

/** Une phrase par code d'erreur de la gestion : courte, et qui dit quoi faire. */
export const ERREURS_GESTION: Readonly<Record<CodeErreurGestion, string>> = {
  non_connecte: 'Votre session a expiré. Reconnectez-vous.',
  invalide: 'Une information est incomplète ou invalide. Vérifiez les champs.',
  introuvable: 'Cet élément n’existe plus. Rechargez la page.',
  deja_recu: 'Ce loyer est déjà marqué reçu.',
  limite: 'Ce compte a atteint le nombre maximal de biens (200).',
  indisponible: 'Gérer n’est pas disponible pour le moment. Réessayez dans quelques minutes.',
  reseau: 'Impossible de joindre Deklic. Vérifiez votre connexion internet.',
  inconnue: 'Quelque chose n’a pas marché. Réessayez.',
};
