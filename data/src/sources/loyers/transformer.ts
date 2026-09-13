import { champ, type EnregistrementCsv } from '../../commun/csv.ts';
import { arrondir } from '../../commun/statistiques.ts';
import type { IndicateurLoyer, LoyersCommune, TypeIndicateurLoyer } from '../../schemas/loyers.ts';

export interface LigneIndicateur {
  readonly codeInsee: string;
  readonly departement: string;
  readonly indicateur: IndicateurLoyer;
}

/** Communes d'un département, par code INSEE. */
export type LoyersParDepartement = Map<string, Record<string, LoyersCommune>>;

/** Nombre écrit à la française (virgule décimale) ; NaN si vide ou illisible. */
export function nombreDecimal(texte: string): number {
  const propre = texte.trim();
  return propre === '' ? Number.NaN : Number(propre.replace(',', '.'));
}

/**
 * Lit une ligne ANIL : loyer prédit, bornes de l'intervalle de prédiction, type de prédiction
 * (`commune` ou `maille`), nombre d'annonces observées dans la commune.
 */
export function indicateurDepuisLigne(ligne: EnregistrementCsv): LigneIndicateur | null {
  const loyer = nombreDecimal(champ(ligne, 'loypredm2'));
  const bas = nombreDecimal(champ(ligne, 'lwr.IPm2'));
  const haut = nombreDecimal(champ(ligne, 'upr.IPm2'));
  if (!(loyer > 0 && bas > 0 && haut > 0)) {
    return null;
  }
  const observations = Number.parseInt(champ(ligne, 'nbobs_com'), 10);
  return {
    codeInsee: champ(ligne, 'INSEE_C'),
    departement: champ(ligne, 'DEP'),
    indicateur: {
      loyerM2: arrondir(loyer, 2),
      basM2: arrondir(bas, 2),
      hautM2: arrondir(haut, 2),
      maille: champ(ligne, 'TYPPRED') === 'maille',
      observations: Number.isNaN(observations) ? 0 : observations,
    },
  };
}

/** Assemble les indicateurs des quatre fichiers par commune, regroupés par département. */
export function assemblerLoyers(
  lignesParType: ReadonlyMap<TypeIndicateurLoyer, readonly LigneIndicateur[]>,
): LoyersParDepartement {
  const resultat: LoyersParDepartement = new Map();
  for (const [type, lignes] of lignesParType) {
    for (const ligne of lignes) {
      let communes = resultat.get(ligne.departement);
      if (communes === undefined) {
        communes = {};
        resultat.set(ligne.departement, communes);
      }
      let commune = communes[ligne.codeInsee];
      if (commune === undefined) {
        commune = {};
        communes[ligne.codeInsee] = commune;
      }
      commune[type] = ligne.indicateur;
    }
  }
  return resultat;
}
