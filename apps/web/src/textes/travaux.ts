import type { EstimationTravaux, TravauxChoix } from '@loupe/moteur';

import { euros, nombre } from '@/formatage/nombres';

import { LIBELLES_ETATS } from './estimation';

/** Mention qui accompagne tout montant de travaux estimé. */
export const MENTION_TRAVAUX = 'Hors aides, à confirmer par devis.';

export const LIBELLES_CHOIX_TRAVAUX: Readonly<Record<Exclude<TravauxChoix, 'saisi'>, string>> = {
  bas: 'Bas',
  estime: 'Estimé',
  haut: 'Haut',
};

/** « À rafraîchir · 65 m² × 400 €/m² » ou « DPE F : rénovation énergétique · 65 m² × 250 €/m² ». */
export function libelleLigneTravaux(
  ligne: EstimationTravaux['lignes'][number],
  estimation: EstimationTravaux,
): string {
  const calcul = `${nombre(ligne.surface)} m² × ${euros(ligne.prixM2.estime)}/m²`;
  if (ligne.code === 'etat') return `${LIBELLES_ETATS[estimation.etat]} · ${calcul}`;
  return `DPE ${estimation.dpe ?? ''} : rénovation énergétique · ${calcul}`;
}

/** « Fourchette 22 800 € à 78 000 € ». */
export function fourchetteTravaux(estimation: EstimationTravaux): string {
  return `Fourchette ${euros(estimation.bas)} à ${euros(estimation.haut)}`;
}

/** Sous le choix de l'état (onglet Estimation) : « Travaux estimés pour cet état : 26 000 €. » */
export function phraseTravauxEtat(estimation: EstimationTravaux | null): string | null {
  if (estimation === null) return null;
  if (estimation.estime === 0) {
    return `Travaux estimés pour cet état : aucun (jusqu'à ${euros(estimation.haut)}). ${MENTION_TRAVAUX}`;
  }
  return `Travaux estimés pour cet état : ${euros(estimation.estime)} (${fourchetteTravaux(estimation).toLowerCase()}). ${MENTION_TRAVAUX}`;
}

export const PHRASES_TRAVAUX = {
  titre: 'Travaux',
  source: 'Barème Deklic 2026-09 d’après des fourchettes publiques de professionnels, à confirmer.',
  revenir: "Revenir à l'estimation",
  sansEtat: "Indiquez l'état du bien pour estimer les travaux.",
  prixEtTravaux:
    "Un bien à rénover se vend moins cher parce qu'il y a des travaux : l'estimation du prix en tient compte, les travaux restent à payer.",
  saisi: 'Montant saisi : il ne suit plus l’état du bien.',
} as const;

/** Libellé de la ligne du coût total : « Travaux estimés » s'ils viennent de l'estimation. */
export function libelleTravauxCout(choix: TravauxChoix | undefined): string {
  return choix === undefined || choix === 'saisi' ? 'Travaux' : 'Travaux estimés';
}
