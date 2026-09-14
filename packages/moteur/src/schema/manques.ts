import { z } from 'zod';

import { CHAMP_LOYER_PAR_MODE, loyerConnu, type ModeLocation } from './hypotheses';
import type { Projet } from './projet';

/**
 * Données sans défaut honnête, que le moteur ne remplace jamais par une valeur inventée.
 * `LOYER_ABSENT` (le loyer, le loyer par chambre ou la nuitée selon le type) rend le rapport partiel. Les revenus ne sont jamais demandés : ils ne manquent pas.
 * Les phrases sont écrites côté interface, jamais ici.
 */
export const CodeManqueSchema = z.enum(['LOYER_ABSENT']);
export type CodeManque = z.infer<typeof CodeManqueSchema>;

export const ManqueSchema = z.strictObject({
  code: CodeManqueSchema,
  /** Chemin pointé du champ dans le projet, celui des descripteurs de l'onglet Hypothèses. */
  champ: z.string().min(1),
});

export interface Manque {
  readonly code: CodeManque;
  readonly champ: string;
}

export const CHAMP_LOYER = 'hypotheses.location.loyerHc';

/** Chemin du champ qui porte le loyer du type : loyer, loyer par chambre ou nuitée. */
export function champLoyer(mode: ModeLocation): string {
  return `hypotheses.location.${CHAMP_LOYER_PAR_MODE[mode]}`;
}

/** Les données absentes d'un projet validé. */
export function manquesDe(projet: Projet): Manque[] {
  const { location } = projet.hypotheses;
  return loyerConnu(location) ? [] : [{ code: 'LOYER_ABSENT', champ: champLoyer(location.mode) }];
}

/** Le premier manque parmi ceux qui expliquent un feu ou une section absente. */
export function raisonParmi(
  manques: readonly Manque[],
  codes: readonly CodeManque[],
): CodeManque | null {
  return manques.find((m) => codes.includes(m.code))?.code ?? null;
}
