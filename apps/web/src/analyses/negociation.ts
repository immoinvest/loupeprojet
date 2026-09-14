import { tauxPourPrixRetenu, type Hypotheses } from '@loupe/moteur';

type Achat = Hypotheses['achat'];

/** Bornes du curseur de négociation, en pourcentage du prix affiché : 0 à −15 % par pas de 0,5 %. */
export const CURSEUR_NEGOCIATION = { min: 0, max: 15, pas: 0.5 } as const;

/** Taux stocké (0,05) → valeur du curseur (5), sans bruit de flottant. */
export function pourcentNegociation(taux: number): number {
  return Math.round(taux * 1000) / 10;
}

/**
 * Valeur du curseur qui amène le prix retenu au plus près d'un prix visé (le centre de l'estimation) :
 * arrondie au pas, au moins un pas, au plus le maximum du curseur. `null` quand le prix affiché est
 * déjà au niveau ou sous le prix visé : rien à négocier d'après le marché.
 */
export function pourcentPourViser(achat: Achat, prixVise: number): number | null {
  const taux = tauxPourPrixRetenu(achat, prixVise);
  if (taux <= 0) return null;
  const { pas, max } = CURSEUR_NEGOCIATION;
  const pourcent = Math.round((taux * 100) / pas) * pas;
  return Math.min(max, Math.max(pas, pourcent));
}
