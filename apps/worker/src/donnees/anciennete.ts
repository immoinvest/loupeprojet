/** Dates civiles `AAAA-MM-JJ`, lues en temps universel. */
const DATE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface Periode {
  readonly debut: string;
  readonly fin: string;
}

/**
 * Mois civils entiers écoulés entre une date et un instant : du 13 janvier 2025 au 13 septembre 2026,
 * 20 mois ; au 12 septembre, 19. Jamais négatif ; `null` sans date ou pour une date mal formée.
 */
export function moisEntre(dateIso: string | null, maintenant: number): number | null {
  const lecture = dateIso === null ? null : DATE_ISO.exec(dateIso);
  if (lecture === null) return null;
  const [, annee, mois, jour] = lecture;
  const instant = new Date(maintenant);
  const total =
    (instant.getUTCFullYear() - Number(annee)) * 12 +
    (instant.getUTCMonth() + 1 - Number(mois)) -
    (instant.getUTCDate() < Number(jour) ? 1 : 0);
  return Math.max(0, total);
}

/** Jour du milieu d'une période : du 1er janvier 2024 au 31 décembre 2025, le 31 décembre 2024. */
export function milieuDePeriode(periode: Periode): string {
  const debut = Date.parse(`${periode.debut}T00:00:00Z`);
  const fin = Date.parse(`${periode.fin}T00:00:00Z`);
  return new Date((debut + fin) / 2).toISOString().slice(0, 10);
}
