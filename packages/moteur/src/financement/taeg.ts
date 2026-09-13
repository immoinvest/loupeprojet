import { resoudreOuNull } from '../commun/resolution';
import type { LigneAmortissement } from './amortissement';

/**
 * Taux annuel effectif global : taux actuariel qui égalise le capital réellement
 * disponible (capital − frais fixes) et la somme actualisée des paiements.
 * `null` si le prêt est nul ou si les paiements ne couvrent pas le capital net.
 */
export function taeg(
  capitalNet: number,
  lignes: readonly LigneAmortissement[],
  avecAssurance: boolean,
): number | null {
  if (capitalNet <= 0 || lignes.length === 0) return null;
  const paiements = lignes.map((l) => l.mensualite + (avecAssurance ? l.assurance : 0));
  const ecart = (tauxMensuel: number): number =>
    paiements.reduce((acc, p, idx) => acc + p / (1 + tauxMensuel) ** (idx + 1), 0) - capitalNet;
  const tauxMensuel = resoudreOuNull(ecart, 0, 1, { tolerance: 1e-12 });
  return tauxMensuel === null ? null : (1 + tauxMensuel) ** 12 - 1;
}
