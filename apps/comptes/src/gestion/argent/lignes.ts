import {
  DepenseSchema,
  PretEnregistreSchema,
  type Depense,
  type PretEnregistre,
} from '@loupe/gestion';

import type { Ligne } from '../lignes';

/** Une colonne NULL est un champ absent. */
function sansNulls(ligne: Ligne): Record<string, unknown> {
  return Object.fromEntries(Object.entries(ligne).filter(([, valeur]) => valeur !== null));
}

/** Une ligne de gestion_depense : `recuperable` en 0/1, la récurrence en deux colonnes. */
export function versDepense(ligne: Ligne): Depense {
  const { recuperable, frequence, jusquAu, ...reste } = sansNulls(ligne);
  const recurrence =
    frequence === undefined
      ? {}
      : { recurrence: { frequence, ...(jusquAu === undefined ? {} : { jusquAu }) } };
  return DepenseSchema.parse({ ...reste, recuperable: recuperable === 1, ...recurrence });
}

export function versPret(ligne: Ligne): PretEnregistre {
  return PretEnregistreSchema.parse(sansNulls(ligne));
}
