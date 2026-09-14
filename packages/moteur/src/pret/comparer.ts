import type { OffrePret } from './schema';
import type { ResultatPret } from './simuler';

export const CODES_CRITERES = [
  'mensualiteTotale',
  'coutTotalCredit',
  'totalInterets',
  'totalAssurance',
  'taegHorsAssurance',
  'taegAvecAssurance',
  'montantEmprunte',
  'dureeAnnees',
  'endettement',
] as const;
export type CodeCritere = (typeof CODES_CRITERES)[number];

export interface CritereCompare {
  readonly code: CodeCritere;
  readonly a: number | null;
  readonly b: number | null;
  /** a − b ; `null` dès qu'une valeur manque. */
  readonly ecart: number | null;
  /** L'offre à la plus petite valeur ; `null` à égalité, valeur absente ou critère informatif. */
  readonly meilleure: 'a' | 'b' | null;
}

export interface ComparaisonOffres {
  readonly criteres: readonly CritereCompare[];
}

/** Une durée plus courte ou un montant plus faible ne sont pas « meilleurs » en soi. */
const INFORMATIFS: ReadonlySet<CodeCritere> = new Set(['montantEmprunte', 'dureeAnnees']);

/** Taux en décimal : égalité à 0,001 point près. */
const TAUX: ReadonlySet<CodeCritere> = new Set([
  'taegHorsAssurance',
  'taegAvecAssurance',
  'endettement',
]);
const TOLERANCE_TAUX = 0.00001;
/** Montants et durées : égalité à 1 centime près. */
const TOLERANCE_MONTANT = 0.01;

function tolerance(code: CodeCritere): number {
  return TAUX.has(code) ? TOLERANCE_TAUX : TOLERANCE_MONTANT;
}

function valeur(resultat: ResultatPret, offre: OffrePret, code: CodeCritere): number | null {
  return code === 'dureeAnnees' ? offre.dureeAnnees : resultat[code];
}

function comparer(code: CodeCritere, a: number | null, b: number | null): CritereCompare {
  const ecart = a === null || b === null ? null : a - b;
  const egales = ecart !== null && Math.abs(ecart) < tolerance(code);
  const meilleure =
    ecart === null || egales || INFORMATIFS.has(code) ? null : ecart < 0 ? 'a' : 'b';
  return { code, a, b, ecart, meilleure };
}

/** Critère par critère, dans l'ordre de `CODES_CRITERES`, laquelle des deux offres a la plus petite valeur. */
export function comparerOffres(
  a: ResultatPret,
  b: ResultatPret,
  offreA: OffrePret,
  offreB: OffrePret,
): ComparaisonOffres {
  return {
    criteres: CODES_CRITERES.map((code) =>
      comparer(code, valeur(a, offreA, code), valeur(b, offreB, code)),
    ),
  };
}

/** Toutes les valeurs sont égales (aux tolérances près) ou absentes des deux côtés. */
export function offresIdentiques(comparaison: ComparaisonOffres): boolean {
  return comparaison.criteres.every(
    (c) => c.ecart === null || Math.abs(c.ecart) < tolerance(c.code),
  );
}
