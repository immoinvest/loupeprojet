import { z } from 'zod';

import { lireJsonValide, type Passe } from '../donnees/passe';
import { departementDe, type TypeLogement } from '../marche/fichiers';

/** Contrat de lecture de `dvf/<millesime>/tendance/<departement>.json` (référence : `data/src/schemas/dvf.ts`). */
const PointSchema = z.object({
  periode: z.string().regex(/^\d{4}-S[12]$/),
  ventes: z.number().int().positive(),
  medianeM2: z.number().positive(),
});
export type PointTendance = z.infer<typeof PointSchema>;

const SeriesSchema = z.object({
  appartement: z.array(PointSchema).min(2).optional(),
  maison: z.array(PointSchema).min(2).optional(),
});

export const TendanceSchema = z.object({
  seriesDepartement: SeriesSchema,
  communes: z.record(z.string(), SeriesSchema),
});
export type Tendance = z.infer<typeof TendanceSchema>;

export type ZoneTendance = 'commune' | 'departement';

export interface SerieRetenue {
  readonly zone: ZoneTendance;
  readonly points: readonly PointTendance[];
}

/** Un point de la série et son indice : la médiane lissée sur les semestres voisins, en €/m². */
export interface PointIndice extends PointTendance {
  readonly indice: number;
}

export interface ResumeTendance {
  readonly zone: ZoneTendance;
  /** Semestre auquel les prix sont ramenés : le dernier publié. */
  readonly periodeReference: string;
  /** Évolution de l'indice sur un an et sur deux ans (décimal), `null` quand le semestre manque. */
  readonly evolution1an: number | null;
  readonly evolution2ans: number | null;
  readonly points: readonly PointIndice[];
}

/** Absent (données pas encore republiées) → `null` sans panne ; hors contrat → `null` journalisé. */
export function lireTendance(
  passe: Passe,
  millesime: string,
  codeInsee: string,
): Promise<Tendance | null> {
  return lireJsonValide(
    passe,
    `dvf/${millesime}/tendance/${departementDe(codeInsee)}.json`,
    TendanceSchema,
  );
}

/** 2024-06-30 → 2024-S1 ; la date vient d'un CSV déjà validé (AAAA-MM-JJ). */
export function semestreDe(date: string): string {
  return `${date.slice(0, 4)}-S${Number(date.slice(5, 7)) <= 6 ? '1' : '2'}`;
}

/** 2025-S1 décalé de −2 semestres → 2024-S1. */
export function semestreDecale(periode: string, semestres: number): string {
  const rang = Number(periode.slice(0, 4)) * 2 + Number(periode.slice(6)) - 1 + semestres;
  return `${String(Math.floor(rang / 2))}-S${String((rang % 2) + 1)}`;
}

/**
 * La série de la commune quand elle va jusqu'au même semestre que celle du département (sinon elle
 * ramènerait les prix à une date plus ancienne) ; à défaut celle du département ; `null` sans série.
 */
export function serieRetenue(
  tendance: Tendance,
  codeInsee: string,
  type: TypeLogement,
): SerieRetenue | null {
  const departement = tendance.seriesDepartement[type];
  const commune = tendance.communes[codeInsee]?.[type];
  if (
    commune !== undefined &&
    (departement === undefined || commune.at(-1)?.periode === departement.at(-1)?.periode)
  ) {
    return { zone: 'commune', points: commune };
  }
  return departement === undefined ? null : { zone: 'departement', points: departement };
}

/** Moyenne mobile sur trois semestres publiés voisins, pondérée par le nombre de ventes : lisse le bruit des médianes. */
export function lisser(points: readonly PointTendance[]): PointIndice[] {
  return points.map((point, rang) => {
    const voisins = points.slice(Math.max(0, rang - 1), rang + 2);
    const poids = voisins.reduce((total, v) => total + v.ventes, 0);
    const somme = voisins.reduce((total, v) => total + v.medianeM2 * v.ventes, 0);
    return { ...point, indice: Math.round(somme / poids) };
  });
}

/**
 * Coefficient qui ramène le prix d'une vente au dernier semestre publié : indice du dernier semestre ÷ indice
 * du semestre de la vente. Semestre non publié : le plus proche avant, sinon le premier. Après la série : 1.
 */
export function coefficientPour(indices: readonly PointIndice[], date: string): number {
  const semestre = semestreDe(date);
  let retenu: PointIndice | undefined;
  let dernier = { periode: '', indice: 0 };
  for (const point of indices) {
    if (retenu === undefined || point.periode <= semestre) retenu = point;
    dernier = point;
  }
  if (retenu === undefined || semestre >= dernier.periode) return 1;
  return dernier.indice / retenu.indice;
}

function evolution(indices: readonly PointIndice[], semestres: number): number | null {
  const dernier = indices.at(-1);
  if (dernier === undefined) return null;
  const periode = semestreDecale(dernier.periode, -semestres);
  const depart = indices.find((p) => p.periode === periode);
  return depart === undefined
    ? null
    : Math.round((dernier.indice / depart.indice - 1) * 10_000) / 10_000;
}

export function resumeTendance(
  zone: ZoneTendance,
  indices: readonly PointIndice[],
): ResumeTendance {
  return {
    zone,
    periodeReference: indices.at(-1)?.periode ?? '',
    evolution1an: evolution(indices, 2),
    evolution2ans: evolution(indices, 4),
    points: indices,
  };
}
