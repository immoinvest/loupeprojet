import type { PointCarte } from './carte';
import type { DpeVente } from './contrat';

/** Ce que disent les couleurs des pastilles : prix au m² (défaut), ancienneté de la vente, DPE du logement vendu. */
export const MODES_COULEUR = ['prix', 'anciennete', 'dpe'] as const;
export type ModeCouleur = (typeof MODES_COULEUR)[number];

/** Trois tranches, de la plus favorable à la moins favorable, et « inconnu ». */
export type NiveauPoint = 'bas' | 'milieu' | 'haut' | 'inconnu';

/** Moins d'un an, de un à trois ans, plus de trois ans. */
export const JOURS_ANCIENNETE = { recente: 365, ancienne: 1_095 } as const;

const JOUR_MS = 86_400_000;

/** Jours entre deux dates `AAAA-MM-JJ` ; `NaN` si l'une est illisible. */
export function joursEntre(debut: string, fin: string): number {
  return Math.round((Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / JOUR_MS);
}

export function niveauAnciennete(date: string, aujourdhui: string): NiveauPoint {
  const jours = joursEntre(date, aujourdhui);
  if (Number.isNaN(jours)) return 'inconnu';
  if (jours < JOURS_ANCIENNETE.recente) return 'bas';
  return jours <= JOURS_ANCIENNETE.ancienne ? 'milieu' : 'haut';
}

export function niveauDpe(etiquette: DpeVente['etiquetteDpe'] | null): NiveauPoint {
  switch (etiquette) {
    case null:
      return 'inconnu';
    case 'A':
    case 'B':
    case 'C':
      return 'bas';
    case 'D':
    case 'E':
      return 'milieu';
    case 'F':
    case 'G':
      return 'haut';
  }
}

/** `aujourdhui` : date du jour `AAAA-MM-JJ`, passée par l'écran pour garder la fonction pure. */
export function niveauPoint(point: PointCarte, mode: ModeCouleur, aujourdhui: string): NiveauPoint {
  switch (mode) {
    case 'prix':
      return point.classe;
    case 'anciennete':
      return niveauAnciennete(point.date, aujourdhui);
    case 'dpe':
      return niveauDpe(point.vente?.dpe?.etiquetteDpe ?? null);
  }
}

/** Le choix « DPE » n'est proposé que si au moins une vente de la carte en a un. */
export function modesCouleur(points: readonly PointCarte[]): readonly ModeCouleur[] {
  return points.some((p) => p.vente?.dpe != null) ? MODES_COULEUR : ['prix', 'anciennete'];
}
