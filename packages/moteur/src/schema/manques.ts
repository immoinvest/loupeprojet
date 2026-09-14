import { z } from 'zod';

import type { Projet } from './projet';

/**
 * Données sans défaut honnête, que le moteur ne remplace jamais par une valeur inventée.
 * `LOYER_ABSENT` rend le rapport partiel. Les revenus ne sont jamais demandés : ils ne manquent pas.
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

/** Les données absentes d'un projet validé. */
export function manquesDe(projet: Projet): Manque[] {
  return projet.hypotheses.location.loyerHc === undefined
    ? [{ code: 'LOYER_ABSENT', champ: CHAMP_LOYER }]
    : [];
}

/** Le premier manque parmi ceux qui expliquent un feu ou une section absente. */
export function raisonParmi(
  manques: readonly Manque[],
  codes: readonly CodeManque[],
): CodeManque | null {
  return manques.find((m) => codes.includes(m.code))?.code ?? null;
}
