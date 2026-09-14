import type { ProjetEntree } from '@loupe/moteur';

import { lireChemin } from './chemins';
import { GROUPE_ACHAT, GROUPE_BIEN } from './groupes-bien';
import { GROUPE_CHARGES, GROUPE_FINANCEMENT, GROUPE_FISCALITE } from './groupes-finances';
import { GROUPE_LOCATION } from './groupes-location';
import type { Descripteur, Groupe } from './types';

/**
 * Les cartes de l'onglet Hypothèses, dans l'ordre d'affichage. Le marché (ventes DVF) n'y est
 * plus : l'onglet Estimation est la seule porte d'entrée du repère de prix. Le prêt se règle dans
 * l'onglet Financement (`GROUPE_FINANCEMENT`).
 */
export const GROUPES: readonly Groupe[] = [
  GROUPE_BIEN,
  GROUPE_ACHAT,
  GROUPE_LOCATION,
  GROUPE_CHARGES,
  GROUPE_FISCALITE,
];

/** Tous les champs éditables, quel que soit l'onglet qui les affiche. */
export const TOUS_LES_GROUPES: readonly Groupe[] = [...GROUPES, GROUPE_FINANCEMENT];

/** Retrouve un descripteur par son chemin ; lève une erreur si le chemin n'est pas éditable. */
export function descripteurParChemin(chemin: string): Descripteur {
  for (const groupe of TOUS_LES_GROUPES) {
    for (const d of groupe.champs) {
      if (d.chemin === chemin) return d;
    }
  }
  throw new Error(`Aucun descripteur pour ${chemin}`);
}

/** Clé de provenance associée à un chemin : « hypotheses.achat.prix » → « achat.prix ». */
export function cleProvenance(chemin: string): string {
  return chemin.replace(/^hypotheses\./, '');
}

export function valeurActuelle(projet: ProjetEntree, d: Descripteur): unknown {
  return lireChemin(projet, d.chemin);
}

export { GROUPE_FINANCEMENT };
export type { Descripteur, Groupe, Option } from './types';
