import { nombre } from '@/formatage/nombres';

/** Une constante du moteur, avec sa valeur formatée et d'où elle vient. */
export interface ConstanteMethode {
  readonly libelle: string;
  readonly valeur: string;
  readonly source: string;
  /** Chemin dans les règles, pour le drapeau « à confirmer ». */
  readonly chemin?: string;
  readonly aConfirmer?: boolean;
}

/** Un module du moteur expliqué : la formule en quelques lignes, puis ses constantes. */
export interface SectionMethode {
  readonly code: string;
  readonly titre: string;
  readonly resume: string;
  readonly etapes: readonly string[];
  readonly constantes: readonly ConstanteMethode[];
}

const MOINS = '−';

/** 0,05 → « 5 % », 0,038 → « 3,8 % », 0,0237 → « 2,37 % », 0,01596 → « 1,596 % », −0,05 → « −5 % ». */
export function pct(taux: number): string {
  const centiemes = Math.round(Math.abs(taux) * 100 * 1000) / 1000;
  const decimales = [0, 1, 2].find((d) => Number.isInteger(centiemes * 10 ** d)) ?? 3;
  return `${taux < 0 ? MOINS : ''}${nombre(centiemes, decimales)} %`;
}

/** −0,05 → « −5 % », 0,05 → « +5 % ». */
export function pctSigne(taux: number): string {
  return `${taux > 0 ? '+' : ''}${pct(taux)}`;
}
