import type { PointVigilance } from '@loupe/moteur';

import { euros, pourcentage } from '@/formatage/nombres';

function param(point: PointVigilance, cle: string): number | string {
  return point.parametres[cle] ?? '';
}

function nombreParam(point: PointVigilance, cle: string): number {
  const v = param(point, cle);
  return typeof v === 'number' ? v : 0;
}

/** Phrase à afficher pour un point financier rendu par le moteur (carte « Avant de faire une offre »). */
export function phraseVigilance(point: PointVigilance): string {
  switch (point.code) {
    case 'EFFORT_HCSF_DEPASSE':
      return `Taux d'effort au-dessus du seuil bancaire de ${pourcentage(nombreParam(point, 'seuil'), 0)} : financement difficile.`;
    case 'DUREE_PRET_HORS_HCSF':
      return `Prêt plus long que le maximum bancaire de ${String(param(point, 'dureeMax'))} ans.`;
    case 'PLAFOND_MICRO_DEPASSE':
      return 'Les recettes dépassent le plafond du régime micro choisi : passer au réel.';
    case 'LOYER_AU_DESSUS_PLAFOND':
      return `Loyer au-dessus du plafond d'encadrement (${euros(nombreParam(point, 'plafond'))}).`;
    case 'PS_BIC_A_CONFIRMER':
      return `Prélèvements sociaux du meublé à ${pourcentage(nombreParam(point, 'taux'))} : taux à confirmer.`;
  }
}
