import type { ProjetEntree } from '@loupe/moteur';

import { lireChemin } from './chemins';
import { GROUPE_ACHAT, GROUPE_BIEN, GROUPE_MARCHE } from './groupes-bien';
import {
  GROUPE_CHARGES,
  GROUPE_FINANCEMENT,
  GROUPE_FISCALITE,
  GROUPE_LOCATION,
} from './groupes-finances';
import type { Descripteur, Groupe } from './types';

/** Les champs éditables, dans l'ordre d'affichage de l'onglet Hypothèses. */
export const GROUPES: readonly Groupe[] = [
  GROUPE_BIEN,
  GROUPE_MARCHE,
  GROUPE_ACHAT,
  GROUPE_FINANCEMENT,
  GROUPE_LOCATION,
  GROUPE_CHARGES,
  GROUPE_FISCALITE,
];

/** Clé de provenance associée à un chemin : « hypotheses.achat.prix » → « achat.prix ». */
export function cleProvenance(chemin: string): string {
  return chemin.replace(/^hypotheses\./, '');
}

export function valeurActuelle(projet: ProjetEntree, d: Descripteur): unknown {
  return lireChemin(projet, d.chemin);
}

export type { Descripteur, Groupe, Option } from './types';
