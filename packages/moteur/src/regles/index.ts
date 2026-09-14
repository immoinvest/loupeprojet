import { ErreurVersionRegles } from '../commun/erreurs';
import { regles202609 } from './2026-09';
import type { Regles, VersionRegles } from './types';

const REGLES_PAR_VERSION: Readonly<Record<VersionRegles, Regles>> = {
  '2026-09': regles202609,
};

export const VERSION_REGLES_COURANTE: VersionRegles = '2026-09';

/** Rend le jeu de règles d'une version, ou lève `ErreurVersionRegles`. */
export function obtenirRegles(version: string): Regles {
  const regles = (REGLES_PAR_VERSION as Readonly<Record<string, Regles | undefined>>)[version];
  if (regles === undefined) {
    throw new ErreurVersionRegles(`Version de règles inconnue : ${version}`);
  }
  return regles;
}

export type {
  ComposantAmortissement,
  Palier,
  PalierRayon,
  PeriodeAbattement,
  Regles,
  SeuilNiveau,
  Tranche,
  VersionRegles,
} from './types';
