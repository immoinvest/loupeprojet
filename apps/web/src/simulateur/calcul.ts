import {
  comparerOffres,
  simulerPret,
  type ComparaisonOffres,
  type Regles,
  type ResultatPret,
} from '@loupe/moteur';

import { nomOffre, versSimulation, type Conversion, type Saisie } from './saisie';

/** Tout ce que les écrans affichent, calculé une fois par saisie. */
export interface Calcul {
  readonly saisie: Saisie;
  readonly conversion: Conversion;
  readonly resultats: readonly [ResultatPret | null, ResultatPret | null];
  /** Présente quand les deux offres se calculent. */
  readonly comparaison: ComparaisonOffres | null;
  readonly noms: readonly [string, string];
}

export function calculer(saisie: Saisie, regles: Regles): Calcul {
  const conversion = versSimulation(saisie);
  const { projet, offres } = conversion;
  const [a, b] = offres;
  const ra = projet !== null && a !== null ? simulerPret(projet, a, regles) : null;
  const rb = projet !== null && b !== null ? simulerPret(projet, b, regles) : null;
  const comparaison =
    ra !== null && rb !== null && a !== null && b !== null ? comparerOffres(ra, rb, a, b) : null;
  return {
    saisie,
    conversion,
    resultats: [ra, rb],
    comparaison,
    noms: [nomOffre(saisie.offres[0].nom, 0), nomOffre(saisie.offres[1]?.nom ?? '', 1)],
  };
}
