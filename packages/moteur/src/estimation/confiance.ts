import { arrondir, arrondirTaux } from '../commun/arrondi';
import type { NiveauConfiance, Palier, Regles } from '../regles/types';
import type { Dvf, PrecisionDvf } from '../schema/marche';

export type CodeComposante = 'localisation' | 'comparables' | 'dispersion' | 'anciennete';

export interface ComposanteConfiance {
  readonly code: CodeComposante;
  /**
   * Grandeur mesurée : rayon du repère en mètres (localisation, `null` hors quartier), nombre de ventes,
   * écart interquartile ÷ médiane (`null` sans quartiles), ancienneté médiane en mois.
   */
  readonly valeur: number | null;
  readonly points: number;
  readonly maximum: number;
  /** Vrai quand la grandeur manque et que les règles ont supposé une valeur. */
  readonly supposee: boolean;
}

export interface ConfianceEstimation {
  /** De 0 à 100, somme des points des composantes. */
  readonly note: number;
  readonly niveau: NiveauConfiance;
  readonly precision: PrecisionDvf;
  readonly composantes: readonly ComposanteConfiance[];
}

/**
 * Points d'un barème à une valeur : en deçà du premier palier ses points, au-delà du dernier ses points,
 * entre deux paliers l'interpolation linéaire. Les paliers sont triés par valeur croissante.
 */
export function interpolerPaliers(paliers: readonly Palier[], valeur: number): number {
  let bas: Palier | undefined;
  for (const haut of paliers) {
    if (valeur <= haut.valeur) {
      if (bas === undefined) return haut.points;
      return (
        bas.points +
        ((haut.points - bas.points) * (valeur - bas.valeur)) / (haut.valeur - bas.valeur)
      );
    }
    bas = haut;
  }
  return bas?.points ?? 0;
}

function maximumDe(paliers: readonly Palier[]): number {
  return Math.max(...paliers.map((p) => p.points));
}

/** Précision écrite dans le repère, sinon déduite : un rayon connu vient d'une analyse d'adresse. */
export function precisionDe(dvf: Dvf): PrecisionDvf {
  if (dvf.precision !== undefined) return dvf.precision;
  return dvf.rayonMetres === undefined ? 'commune' : 'quartier';
}

/** Écart interquartile rapporté à la médiane ; `null` sans les deux quartiles. */
export function dispersionDe(dvf: Dvf): number | null {
  if (dvf.q1M2 === undefined || dvf.q3M2 === undefined) return null;
  return (dvf.q3M2 - dvf.q1M2) / dvf.medianM2;
}

export function pointsLocalisation(
  precision: PrecisionDvf,
  rayonMetres: number | undefined,
  regles: Regles,
): number {
  const l = regles.estimation.confiance.localisation;
  if (precision !== 'quartier') return l[precision];
  const dernier = l.quartier[l.quartier.length - 1]?.points ?? 0;
  if (rayonMetres === undefined) return dernier;
  const palier = l.quartier.find((p) => p.jusquaMetres === null || rayonMetres <= p.jusquaMetres);
  return palier?.points ?? dernier;
}

function maximumLocalisation(regles: Regles): number {
  const l = regles.estimation.confiance.localisation;
  return Math.max(l.immeuble, l.rue, l.commune, ...l.quartier.map((p) => p.points));
}

/**
 * Note de confiance de l'estimation : localisation du repère, nombre de ventes comparables, dispersion
 * des prix et ancienneté des ventes, chacune notée selon son barème daté. Pure.
 */
export function confianceEstimation(dvf: Dvf, regles: Regles): ConfianceEstimation {
  const c = regles.estimation.confiance;
  const precision = precisionDe(dvf);
  const dispersion = dispersionDe(dvf);
  const ancienneteSupposee = dvf.ancienneteMedianeMois === undefined;
  const anciennete = dvf.ancienneteMedianeMois ?? c.ancienneteSupposeeMois;
  const composantes: readonly ComposanteConfiance[] = [
    {
      code: 'localisation',
      valeur: precision === 'quartier' ? (dvf.rayonMetres ?? null) : null,
      points: arrondir(pointsLocalisation(precision, dvf.rayonMetres, regles), 0),
      maximum: maximumLocalisation(regles),
      supposee: false,
    },
    {
      code: 'comparables',
      valeur: dvf.nombreVentes,
      points: arrondir(interpolerPaliers(c.comparables, dvf.nombreVentes), 0),
      maximum: maximumDe(c.comparables),
      supposee: false,
    },
    {
      code: 'dispersion',
      valeur: dispersion === null ? null : arrondirTaux(dispersion),
      points: dispersion === null ? 0 : arrondir(interpolerPaliers(c.dispersion, dispersion), 0),
      maximum: maximumDe(c.dispersion),
      supposee: false,
    },
    {
      code: 'anciennete',
      valeur: anciennete,
      points: arrondir(interpolerPaliers(c.anciennete, anciennete), 0),
      maximum: maximumDe(c.anciennete),
      supposee: ancienneteSupposee,
    },
  ];
  const note = composantes.reduce((somme, composante) => somme + composante.points, 0);
  const niveau = c.niveaux.find((s) => note >= s.des)?.niveau ?? 'tres_faible';
  return { note, niveau, precision, composantes };
}
