import type { EffetModification } from '@/hypotheses/effet';
import type { Origine } from '@/hypotheses/liens';

/** Le nom de chaque origine d'un lien, tel qu'affiché dans la bande des volets. */
export const LIBELLES_ORIGINE: Readonly<Record<Origine, string>> = {
  rapport: 'Rapport',
  adresse: 'Estimation',
  financement: 'Financement',
  hypotheses: 'Hypothèses',
  fiscalite: 'Fiscalité',
  revente: 'Revente',
  visite: 'Visite',
  comparer: 'Comparer',
};

export const TEXTES_LIENS = {
  revenir: (origine: Origine): string => `Revenir à ${LIBELLES_ORIGINE[origine]}`,
  utilisePar: 'Utilisé par :',
  /** Nom accessible d'un chiffre cliquable : la valeur, puis ce qu'on y change. */
  modifier: (valeur: string, libelle: string): string => `${valeur} — modifier ${libelle}`,
  voirHypotheses: 'Voir toutes les hypothèses',
  fermer: 'Fermer',
} as const;

/** « Loyer visé : 980 € → 1 300 €. Cash-flow : −210 €/mois → +91 €/mois. » */
export function phraseEffet(effet: EffetModification): string {
  return [effet, ...effet.indicateurs]
    .map((e) => `${e.libelle} : ${e.avant} → ${e.apres}.`)
    .join(' ');
}
