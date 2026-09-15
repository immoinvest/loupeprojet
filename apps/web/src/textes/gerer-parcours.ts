import type { CibleRetour } from '@/gestion/parcours';
import { moisEnLettres } from '@/gestion/format';

import { de } from './gerer-ecrans';

/** Textes qui relient les pages de Gérer : fil d'Ariane, retours, nouveau locataire (tutoiement). */
export const TEXTES_PARCOURS = {
  filAriane: 'Fil d’Ariane',
  gerer: 'Gérer',
  mesBiens: 'Mes biens',
  mesLocataires: 'Mes locataires',
  voirSaFiche: 'Voir sa fiche',
  nouveauLocataire: 'Nouveau locataire',
  nouveauLocataireChapo:
    'Le bien, le locataire et le loyer : Deklic calcule ensuite chaque loyer attendu et ses quittances.',
  /** Le bouton d'une ligne vacante de Mes biens (suivi du nom du bien, lu par les lecteurs d'écran). */
  louer: 'Louer',
  ajouterLocataire: 'Ajouter un locataire',
} as const;

/** Nom accessible du montant d'une ligne de loyer : « 700 € — modifier la location de T2 Lices ». */
export function modifierLaLocation(montant: string, bien: string): string {
  return `${montant} — modifier la location ${de(bien)}`;
}

/** Après « Enregistrer » dans « Nouveau locataire » : « Léa Bernard loue Parking Prado. » */
export function locationCreeeMessage(locataire: string, bien: string): string {
  return `${locataire} loue ${bien}.`;
}

/** Le lien de retour d'un document : « Loyers du mois », « Loyers de mars 2026 », « T2 Lices »… */
export function libelleRetour(cible: CibleRetour): string {
  switch (cible.type) {
    case 'loyers_du_mois':
      return 'Loyers du mois';
    case 'loyers':
      return cible.periode === null
        ? 'Tous les loyers'
        : `Loyers ${de(moisEnLettres(cible.periode))}`;
    case 'mes_biens':
      return TEXTES_PARCOURS.mesBiens;
    case 'mes_locataires':
      return TEXTES_PARCOURS.mesLocataires;
    case 'bien':
    case 'locataire':
      return cible.nom;
  }
}
