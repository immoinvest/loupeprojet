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

/** 65 000 centimes → « 650 € » ; 65 050 → « 650,50 € » : les centimes seulement quand il y en a. */
export function montant(centimes: number): string {
  const format = centimes % 100 === 0 ? EUROS_ENTIERS : EUROS_CENTIMES;
  return format.format(centimes / 100);
}

/** « 2026-09 » → « septembre 2026 ». */
export function moisEnLettres(periode: string): string {
  return MOIS.format(new Date(`${periode}-01T00:00:00Z`));
}

/** « 2026-10-05 » → « le 5 » ; « 2026-10-01 » → « le 1er ». */
export function leJour(jour: string): string {
  const numero = Number(jour.slice(8, 10));
  return numero === 1 ? 'le 1er' : `le ${String(numero)}`;
}
