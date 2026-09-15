/** Formats de nombres et de dates, alignés sur l'application (apps/web/src/formatage/nombres.ts). */

const MOINS = '−';

/**
 * Intl sépare les milliers par une espace fine insécable, absente des polices servies par le site :
 * elle s'afficherait « 12143 € ». On la remplace par une espace insécable ordinaire.
 */
const ESPACE_FINE = String.fromCharCode(0x202f);
const ESPACE_INSECABLE = String.fromCharCode(0x00a0);

function lisible(texte: string): string {
  return texte.replaceAll(ESPACE_FINE, ESPACE_INSECABLE);
}

const intlEuros = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});
const formatEuros = { format: (valeur: number): string => lisible(intlEuros.format(valeur)) };

function signe(valeur: number, texteAbsolu: string, avecPlus: boolean): string {
  if (valeur < 0) return `${MOINS}${texteAbsolu}`;
  return avecPlus && valeur > 0 ? `+${texteAbsolu}` : texteAbsolu;
}

/** Arrondi à l'euro, sans jamais produire « −0 ». */
function arrondiEuro(valeur: number): number {
  const arrondi = Math.round(valeur);
  return arrondi === 0 ? 0 : arrondi;
}

/** 155000 → « 155 000 € » ; −210 → « −210 € » (vrai signe moins). */
export function euros(valeur: number): string {
  const arrondi = arrondiEuro(valeur);
  return signe(arrondi, formatEuros.format(Math.abs(arrondi)), false);
}

/** +980 → « +980 €/mois », −210 → « −210 €/mois ». */
export function eurosParMois(valeur: number): string {
  const arrondi = arrondiEuro(valeur);
  return `${signe(arrondi, formatEuros.format(Math.abs(arrondi)), true)}/mois`;
}

export function nombre(valeur: number, decimales = 0): string {
  return lisible(
    new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    }).format(valeur),
  );
}

/** 0.0428 → « 4,3 % » (une décimale par défaut, comme l'application). */
export function pourcentage(taux: number, decimales = 1): string {
  return signe(taux, `${nombre(Math.abs(taux) * 100, decimales)} %`, false);
}

/** −0.218 → « −22 % », 0.03 → « +3 % », 0 → « 0 % ». */
export function pourcentageSigne(taux: number, decimales = 0): string {
  return signe(taux, `${nombre(Math.abs(taux) * 100, decimales)} %`, true);
}

/** Taux d'une règle, sans zéros inutiles : 0.5 → « 50 % », 0.186 → « 18,6 % », 0.0529 → « 5,29 % ». */
export function tauxRegle(taux: number): string {
  const texte = lisible(
    new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Math.abs(taux) * 100),
  );
  return signe(taux, `${texte} %`, false);
}

const formatDateLongue = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Date du frontmatter (minuit UTC) → « 15 septembre 2026 », quel que soit le fuseau du build. */
export function dateLongue(date: Date): string {
  return formatDateLongue.format(date);
}

/** « 2026-09-15 » (données structurées, attribut datetime). */
export function dateIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}
