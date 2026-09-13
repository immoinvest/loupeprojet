import { champ, type EnregistrementCsv } from '../../commun/csv.ts';
import { arrondir } from '../../commun/statistiques.ts';
import type { TauxTaxeFonciere } from '../../schemas/taxe-fonciere.ts';
import { VARIABLES_REI, type PosteTaxeFonciere } from './constantes.ts';

type Cumul = Record<PosteTaxeFonciere, number>;

const DECIMALES_TAUX = 5;

function nouveauCumul(): Cumul {
  return { commune: 0, syndicats: 0, intercommunalite: 0, gemapi: 0, tse: 0, teom: 0 };
}

/** Un taux REI est publié en pourcentage (44,54) ; Loupe le stocke en décimal (0,4454). */
function enDecimal(pourcentage: number): number {
  return arrondir(pourcentage / 100, DECIMALES_TAUX);
}

function tauxDepuisCumul(cumul: Cumul): TauxTaxeFonciere {
  const taux: TauxTaxeFonciere = {
    commune: enDecimal(cumul.commune),
    syndicats: enDecimal(cumul.syndicats),
    intercommunalite: enDecimal(cumul.intercommunalite),
    gemapi: enDecimal(cumul.gemapi),
    tse: enDecimal(cumul.tse),
    total: enDecimal(
      cumul.commune + cumul.syndicats + cumul.intercommunalite + cumul.gemapi + cumul.tse,
    ),
  };
  if (cumul.teom > 0) {
    taux.teom = enDecimal(cumul.teom);
  }
  return taux;
}

/**
 * Additionne, commune par commune, les variables REI retenues (format long : une ligne par variable).
 * Les variables hors liste (taux votés, autres taxes) et les montants vides sont ignorés.
 */
export async function tauxDepuisLignes(
  lignes: AsyncIterable<EnregistrementCsv>,
): Promise<Record<string, TauxTaxeFonciere>> {
  const cumuls = new Map<string, Cumul>();
  for await (const ligne of lignes) {
    const poste = VARIABLES_REI[champ(ligne, 'var')];
    const texte = champ(ligne, 'valeur');
    if (poste === undefined || texte === '') {
      continue;
    }
    const valeur = Number(texte);
    if (Number.isNaN(valeur)) {
      continue;
    }
    const code = champ(ligne, 'idcom');
    let cumul = cumuls.get(code);
    if (cumul === undefined) {
      cumul = nouveauCumul();
      cumuls.set(code, cumul);
    }
    cumul[poste] += valeur;
  }
  const resultat: Record<string, TauxTaxeFonciere> = {};
  for (const [code, cumul] of cumuls) {
    resultat[code] = tauxDepuisCumul(cumul);
  }
  return resultat;
}
