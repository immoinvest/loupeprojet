import { fraisAcquisition } from '../financement/frais-acquisition';
import type { Regles } from '../regles/types';

/**
 * Frais de notaire d'un achat, estimés par la formule réelle des frais d'acquisition
 * (droits départementaux, émoluments par tranches, contribution, débours) sur le prix hors
 * honoraires d'agence. Sans département : taux départemental par défaut des règles.
 */
export function fraisNotaireEstimes(
  prix: number,
  honorairesAgence: number,
  departement: string | undefined,
  regles: Regles,
): number {
  const base = prix - Math.max(0, honorairesAgence);
  if (base <= 0) return 0;
  return fraisAcquisition(
    {
      prix: base,
      honorairesAgence: 0,
      honorairesChargeAcquereur: true,
      travaux: 0,
      travauxRenovationEnergetique: false,
      mobilier: 0,
      // Le prix saisi dans le simulateur est déjà celui de l'offre : aucune négociation à retirer.
      negociationTaux: 0,
    },
    departement ?? '',
    regles,
  ).total;
}
