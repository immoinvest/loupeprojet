import type { ResumeAchat } from '@loupe/moteur';

import { euros, nombre } from '@/formatage/nombres';

/** « 0 % » à zéro, sinon « −5 % », « −7,5 % » (valeur en pourcentage du prix affiché). */
export function libelleNegociation(pourcent: number): string {
  const p = Math.round(pourcent * 10) / 10;
  if (p === 0) return '0 %';
  return `−${nombre(p, Number.isInteger(p) ? 0 : 1)} %`;
}

/** Depuis le taux stocké (0,05 → « −5 % »). */
export function libelleTauxNegociation(taux: number): string {
  return libelleNegociation(taux * 100);
}

/** « Prix affiché 155 000 € », ou « Prix affiché 155 000 € · retenu 147 250 € (−5 %) ». */
export function phrasePrixAffiche(achat: ResumeAchat): string {
  const affiche = `Prix affiché ${euros(achat.prixAffiche)}`;
  if (achat.negociationTaux === 0) return affiche;
  return `${affiche} · retenu ${euros(achat.prixRetenu)} (${libelleTauxNegociation(achat.negociationTaux)})`;
}

/** « Prix retenu 155 000 € », ou « Prix retenu 147 250 € · −7 750 € (−5 %) ». */
export function phrasePrixRetenu(achat: ResumeAchat): string {
  const retenu = `Prix retenu ${euros(achat.prixRetenu)}`;
  if (achat.negociationTaux === 0) return retenu;
  return `${retenu} · −${euros(achat.negociationMontant)} (${libelleTauxNegociation(achat.negociationTaux)})`;
}

/** En-tête du projet : « 147 250 € · négocié −5 % », ou le prix seul. */
export function libellePrixEnTete(achat: ResumeAchat): string {
  if (achat.negociationTaux === 0) return euros(achat.prixRetenu);
  return `${euros(achat.prixRetenu)} · négocié ${libelleTauxNegociation(achat.negociationTaux)}`;
}

/** Résumé du dépliant Travaux : « + Ajouter des travaux · mobilier 4 875 € » ou « Travaux 6 000 € · mobilier 5 000 € ». */
export function resumeTravaux(travaux: number, mobilier: number): string {
  const tete = travaux > 0 ? `Travaux ${euros(travaux)}` : '+ Ajouter des travaux';
  return mobilier > 0 ? `${tete} · mobilier ${euros(mobilier)}` : tete;
}

export const PHRASES_ACHAT = {
  sousEstimation:
    "Le prix affiché est déjà sous le prix estimé : rien à négocier d'après le marché.",
  viser: (prixEstime: string): string => `Prix estimé ${prixEstime}.`,
} as const;
