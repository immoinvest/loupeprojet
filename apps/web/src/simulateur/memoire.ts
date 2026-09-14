import { SimulationPretSchema, type SimulationPret } from '@loupe/moteur';

/** La dernière simulation valide, retrouvée à la prochaine visite. Jamais d'exception. */
export const CLE_SIMULATEUR = 'loupe.simulateur.v1';

export function lireSimulation(stockage: Storage): SimulationPret | null {
  const brut = stockage.getItem(CLE_SIMULATEUR);
  if (brut === null) return null;
  try {
    const resultat = SimulationPretSchema.safeParse(JSON.parse(brut));
    return resultat.success ? resultat.data : null;
  } catch {
    return null;
  }
}

/** Un stockage plein ou interdit ne casse pas la page : l'écriture échoue en silence. */
export function ecrireSimulation(stockage: Storage, simulation: SimulationPret): void {
  try {
    stockage.setItem(CLE_SIMULATEUR, JSON.stringify(simulation));
  } catch {
    // Rien à faire : la simulation reste à l'écran.
  }
}
