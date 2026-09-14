import { elementA } from '../../commun/listes.ts';
import { arrondir, quantile } from '../../commun/statistiques.ts';
import type { PointTendance, SeriesTendance, Vente } from '../../schemas/dvf.ts';
import { MINIMUM_POINTS_TENDANCE } from './constantes.ts';

/** Semestre civil d'une date : 2024-06-30 → 2024-S1, 2024-07-01 → 2024-S2. */
export function semestreDe(date: string): string {
  const correspondance = /^(\d{4})-(\d{2})-\d{2}$/.exec(date);
  if (correspondance === null) {
    throw new RangeError(`date ISO attendue (AAAA-MM-JJ) : ${date}`);
  }
  const mois = Number(elementA(correspondance, 2));
  return `${elementA(correspondance, 1)}-S${mois <= 6 ? '1' : '2'}`;
}

/** Médiane du prix au m² par semestre, pour les semestres qui comptent au moins `seuil` ventes, triés. */
export function serieDesVentes(ventes: readonly Vente[], seuil: number): PointTendance[] {
  const parSemestre = new Map<string, number[]>();
  for (const vente of ventes) {
    const semestre = semestreDe(vente.date);
    const prixM2 = vente.prix / vente.surface;
    const liste = parSemestre.get(semestre);
    if (liste === undefined) {
      parSemestre.set(semestre, [prixM2]);
    } else {
      liste.push(prixM2);
    }
  }
  return [...parSemestre.entries()]
    .filter(([, prix]) => prix.length >= seuil)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periode, prix]) => ({
      periode,
      ventes: prix.length,
      medianeM2: arrondir(
        quantile(
          [...prix].sort((a, b) => a - b),
          0.5,
        ),
        0,
      ),
    }));
}

function seriesParType(ventes: readonly Vente[], seuil: number): SeriesTendance {
  const series: { appartement?: PointTendance[]; maison?: PointTendance[] } = {};
  for (const type of ['appartement', 'maison'] as const) {
    const serie = serieDesVentes(
      ventes.filter((vente) => vente.type === type),
      seuil,
    );
    if (serie.length >= MINIMUM_POINTS_TENDANCE) {
      series[type] = serie;
    }
  }
  return series;
}

export interface TendanceDesVentes {
  readonly seriesDepartement: SeriesTendance;
  readonly communes: Record<string, SeriesTendance>;
}

/** Séries du département (toutes communes confondues) et des communes qui ont au moins deux semestres exploitables. */
export function tendanceDesVentes(
  ventesParCommune: ReadonlyMap<string, readonly Vente[]>,
  seuil: number,
): TendanceDesVentes {
  const communes: Record<string, SeriesTendance> = {};
  const entrees = [...ventesParCommune.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [code, ventes] of entrees) {
    const series = seriesParType(ventes, seuil);
    if (series.appartement !== undefined || series.maison !== undefined) {
      communes[code] = series;
    }
  }
  return {
    seriesDepartement: seriesParType([...ventesParCommune.values()].flat(), seuil),
    communes,
  };
}
