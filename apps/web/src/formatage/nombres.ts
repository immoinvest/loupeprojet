const MOINS = '−';

const formatEuros = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

function signe(valeur: number, texteAbsolu: string, avecPlus: boolean): string {
  if (valeur < 0) return `${MOINS}${texteAbsolu}`;
  return avecPlus && valeur > 0 ? `+${texteAbsolu}` : texteAbsolu;
}

/** 155000 → « 155 000 € » ; −210 → « −210 € » (vrai signe moins). */
export function euros(valeur: number): string {
  return signe(valeur, formatEuros.format(Math.abs(Math.round(valeur))), false);
}

/** +980 → « +980 € », −210 → « −210 € », 0 → « 0 € ». */
export function eurosSignes(valeur: number): string {
  return signe(valeur, formatEuros.format(Math.abs(Math.round(valeur))), true);
}

export function nombre(valeur: number, decimales = 0): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valeur);
}

/** 0.0428 → « 4,3 % ». */
export function pourcentage(taux: number, decimales = 1): string {
  return `${nombre(Math.abs(taux) * 100, decimales).replace(/^/, taux < 0 ? MOINS : '')} %`;
}

/** −0.218 → « −22 % », 0.03 → « +3 % », 0 → « 0 % ». */
export function pourcentageSigne(taux: number, decimales = 0): string {
  return signe(taux, `${nombre(Math.abs(taux) * 100, decimales)} %`, true);
}

/** « 1 203 € » par mois, forme courte pour les tableaux. */
export function eurosParMois(valeur: number): string {
  return `${eurosSignes(valeur)}/mois`;
}

export function dateCourte(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}
