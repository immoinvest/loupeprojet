import { arrondirEuro } from '../commun/arrondi';
import { NEGOCIATION_MAX, type Hypotheses } from '../schema/hypotheses';

type Achat = Hypotheses['achat'];

/** Le prix affiché, le prix retenu après négociation, et l'écart entre les deux. */
export interface ResumeAchat {
  readonly prixAffiche: number;
  /** Prix sur lequel tout le rapport est calculé : notaire, prêt, rendements, revente, feu prix. */
  readonly prixRetenu: number;
  /** Proportion du prix affiché obtenue en moins (0,05 = −5 %). */
  readonly negociationTaux: number;
  /** Prix affiché − prix retenu, en euros. */
  readonly negociationMontant: number;
}

/**
 * Prix retenu = prix affiché × (1 − négociation), arrondi à l'euro comme une offre d'achat.
 * À négociation nulle, le prix affiché est rendu tel quel : aucun arrondi ne s'y glisse.
 * Les honoraires d'agence, en euros, ne bougent pas.
 */
export function prixRetenu(achat: Achat): number {
  if (achat.negociationTaux === 0) return achat.prix;
  return arrondirEuro(achat.prix * (1 - achat.negociationTaux));
}

export function negociationMontant(achat: Achat): number {
  return achat.prix - prixRetenu(achat);
}

export function resumerAchat(achat: Achat): ResumeAchat {
  const retenu = prixRetenu(achat);
  return {
    prixAffiche: achat.prix,
    prixRetenu: retenu,
    negociationTaux: achat.negociationTaux,
    negociationMontant: achat.prix - retenu,
  };
}

/**
 * Négociation qui amène le prix retenu à un prix visé (le centre de l'estimation, une offre) :
 * 0 quand le prix visé dépasse le prix affiché, au plus la borne du schéma.
 */
export function tauxPourPrixRetenu(achat: Achat, prixVise: number): number {
  const taux = 1 - prixVise / achat.prix;
  return Math.min(NEGOCIATION_MAX, Math.max(0, taux));
}
