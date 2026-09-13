import { join } from 'node:path';
import type { Contexte } from '../commun/contexte.ts';
import { ecrireJson } from '../commun/fichiers.ts';
import { MillesimeCourantSchema } from '../schemas/meta.ts';

/** Écrit `<prefixe>/courant.json` : le millésime que l'application doit lire pour cette source. */
export async function ecrireMillesimeCourant(
  contexte: Contexte,
  prefixe: string,
  millesime: string,
): Promise<void> {
  const courant = MillesimeCourantSchema.parse({
    genereLe: contexte.horloge().toISOString(),
    millesime,
  });
  await ecrireJson(join(contexte.dossierSortie, prefixe, 'courant.json'), courant);
}
