/** Les 101 départements : 01 à 95 avec 2A et 2B à la place de 20, puis 971 à 974 et 976 (comme geo.api.gouv.fr). */
function listerDepartements(): readonly string[] {
  const codes: string[] = [];
  for (let numero = 1; numero <= 95; numero += 1) {
    if (numero === 20) {
      codes.push('2A', '2B');
    } else {
      codes.push(String(numero).padStart(2, '0'));
    }
  }
  codes.push('971', '972', '973', '974', '976');
  return codes;
}

export const DEPARTEMENTS: readonly string[] = listerDepartements();

export function estDepartement(code: string): boolean {
  return DEPARTEMENTS.includes(code);
}

/** Département d'un code INSEE de commune : 13055 → 13, 2A004 → 2A, 97101 → 971. */
export function departementDeCommune(codeInsee: string): string {
  return codeInsee.startsWith('97') ? codeInsee.slice(0, 3) : codeInsee.slice(0, 2);
}
