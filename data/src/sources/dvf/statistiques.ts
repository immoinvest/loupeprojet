import { arrondir, quartiles } from '../../commun/statistiques.ts';
import type { StatistiquesCommune, StatistiquesType, Vente } from '../../schemas/dvf.ts';

/** Nombre de ventes, médiane et quartiles du prix au m² (arrondis à l'euro) ; null sans vente. */
export function statistiquesDesVentes(ventes: readonly Vente[]): StatistiquesType | null {
  const resume = quartiles(ventes.map((vente) => vente.prix / vente.surface));
  if (resume === null) {
    return null;
  }
  return {
    ventes: ventes.length,
    medianeM2: arrondir(resume.mediane, 0),
    q1M2: arrondir(resume.q1, 0),
    q3M2: arrondir(resume.q3, 0),
  };
}

export function statistiquesCommune(ventes: readonly Vente[]): StatistiquesCommune {
  const resultat: { appartement?: StatistiquesType; maison?: StatistiquesType } = {};
  const appartement = statistiquesDesVentes(ventes.filter((vente) => vente.type === 'appartement'));
  if (appartement !== null) {
    resultat.appartement = appartement;
  }
  const maison = statistiquesDesVentes(ventes.filter((vente) => vente.type === 'maison'));
  if (maison !== null) {
    resultat.maison = maison;
  }
  return resultat;
}

/** Index d'un département : statistiques par commune, communes triées par code INSEE. */
export function indexDesCommunes(
  ventesParCommune: ReadonlyMap<string, readonly Vente[]>,
): Record<string, StatistiquesCommune> {
  const index: Record<string, StatistiquesCommune> = {};
  const entrees = [...ventesParCommune.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [code, ventes] of entrees) {
    index[code] = statistiquesCommune(ventes);
  }
  return index;
}
