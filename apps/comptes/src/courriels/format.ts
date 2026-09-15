/** Montants et dates en français pour les e-mails et le PDF (mêmes règles que apps/web/src/gestion/format.ts). */

const EUROS_ENTIERS = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const EUROS_CENTIMES = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** 65 000 centimes → « 650 € » ; 65 050 → « 650,50 € ». */
export function montant(centimes: number): string {
  const format = centimes % 100 === 0 ? EUROS_ENTIERS : EUROS_CENTIMES;
  return format.format(centimes / 100);
}

/** « 2026-10-12 » → « 12 octobre 2026 » ; le premier du mois s'écrit « 1er ». */
export function dateEnLettres(jour: string): string {
  const numero = Number(jour.slice(8, 10));
  const mois = MOIS.format(new Date(`${jour}T00:00:00Z`));
  return `${numero === 1 ? '1er' : String(numero)} ${mois}`;
}

/** « 2026-10 » → « octobre 2026 ». */
export function moisEnLettres(periode: string): string {
  return MOIS.format(new Date(`${periode}-01T00:00:00Z`));
}

/** « de septembre 2026 », « d’octobre 2026 ». */
export function deMois(periode: string): string {
  const mois = moisEnLettres(periode);
  return /^[aeiou]/.test(mois) ? `d’${mois}` : `de ${mois}`;
}

/** « Julie Martin », « Julie Martin et Léa Bernard », « A, B et C ». */
export function nomsDesLocataires(noms: readonly string[]): string {
  if (noms.length <= 1) return noms.join('');
  return `${noms.slice(0, -1).join(', ')} et ${String(noms.at(-1))}`;
}
