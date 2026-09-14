import type {
  CodeComposante,
  ComposanteConfiance,
  ConfianceEstimation,
  Dvf,
  NiveauConfiance,
  PrecisionDvf,
  TypeBien,
} from '@loupe/moteur';

import { dateCourte, euros, nombre, pourcentage } from '@/formatage/nombres';

import { prixM2 } from './adresse';

export const LIBELLES_CONFIANCE: Readonly<Record<NiveauConfiance, string>> = {
  tres_faible: 'Confiance très faible',
  faible: 'Confiance faible',
  moyenne: 'Confiance moyenne',
  bonne: 'Confiance bonne',
  elevee: 'Confiance élevée',
};

/** Le niveau en minuscules, au fil d'une phrase : « confiance bonne ». */
export function niveauEnPhrase(niveau: NiveauConfiance): string {
  return LIBELLES_CONFIANCE[niveau].toLowerCase();
}

export const TON_CONFIANCE: Readonly<Record<NiveauConfiance, 'bon' | 'neutre' | 'surveiller'>> = {
  tres_faible: 'surveiller',
  faible: 'surveiller',
  moyenne: 'neutre',
  bonne: 'bon',
  elevee: 'bon',
};

export const LIBELLES_COMPOSANTES: Readonly<Record<CodeComposante, string>> = {
  localisation: 'Localisation du repère',
  comparables: 'Ventes comparables',
  dispersion: 'Dispersion des prix',
  anciennete: 'Ancienneté des ventes',
};

export const LIBELLES_PRECISION: Readonly<Record<PrecisionDvf, string>> = {
  immeuble: 'même immeuble',
  rue: 'même rue',
  quartier: 'quartier',
  commune: 'commune',
};

export const PHRASES_CONFIANCE = {
  titre: 'Peut-on se fier à cette estimation ?',
  sansRepere:
    'Pas encore de repère de prix : indiquez le code postal et la ville dans Hypothèses, ou analysez l’adresse du bien ci-dessous.',
  affiner:
    'Indiquez l’adresse du bien ci-dessous pour affiner : les ventes du même immeuble, de la même rue et du quartier remplaceront le repère de commune.',
  ancienneteSupposee:
    'ancienneté inconnue, supposée au milieu de la fenêtre de deux ans des ventes publiées',
  moinsPrecis: 'Moins précis : repère de commune',
  titreRepere: 'Le repère utilisé',
} as const;

/** « Confiance bonne · 72 sur 100 ». */
export function phraseNote(confiance: ConfianceEstimation): string {
  return `${LIBELLES_CONFIANCE[confiance.niveau]} · ${String(confiance.note)} sur 100`;
}

/** « 22/35 ». */
export function pointsSurMaximum(composante: ComposanteConfiance): string {
  return `${String(composante.points)}/${String(composante.maximum)}`;
}

function raisonLocalisation(precision: PrecisionDvf, rayon: number | null): string {
  switch (precision) {
    case 'immeuble':
      return 'Ventes du même immeuble ou des parcelles voisines.';
    case 'rue':
      return 'Ventes de la même rue.';
    case 'quartier':
      return rayon === null
        ? 'Ventes du quartier.'
        : `Ventes du quartier, à ${nombre(rayon)} m au plus.`;
    case 'commune':
      return 'Repère à l’échelle de la commune, sans adresse précise.';
  }
}

function raisonComparables(ventes: number): string {
  return `${nombre(ventes)} ${ventes > 1 ? 'ventes comparables' : 'vente comparable'} (même type de logement, surface proche).`;
}

function raisonDispersion(dispersion: number | null): string {
  if (dispersion === null) return 'Dispersion inconnue : le repère n’a pas de quartiles.';
  const demi = pourcentage(dispersion / 2, 0);
  if (dispersion <= 0.15) return `Prix resserrés : la moitié des ventes à ± ${demi} de la médiane.`;
  if (dispersion <= 0.3)
    return `Prix assez dispersés : la moitié des ventes à ± ${demi} de la médiane.`;
  return `Prix très dispersés : la moitié des ventes à ± ${demi} de la médiane.`;
}

function raisonAnciennete(mois: number | null, supposee: boolean): string {
  if (mois === null) return 'Ancienneté inconnue.';
  const age = mois <= 1 ? 'moins d’un mois' : `${nombre(mois)} mois`;
  return supposee
    ? `Ventes vieilles de ${age} en médiane (${PHRASES_CONFIANCE.ancienneteSupposee}).`
    : `Ventes vieilles de ${age} en médiane.`;
}

/** La raison d'une composante, en clair, avec les chiffres du repère. */
export function raisonComposante(
  composante: ComposanteConfiance,
  confiance: ConfianceEstimation,
): string {
  switch (composante.code) {
    case 'localisation':
      return raisonLocalisation(confiance.precision, composante.valeur);
    case 'comparables':
      return raisonComparables(composante.valeur ?? 0);
    case 'dispersion':
      return raisonDispersion(composante.valeur);
    case 'anciennete':
      return raisonAnciennete(composante.valeur, composante.supposee);
  }
}

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

/** « 2024-01-01 » → « janvier 2024 ». */
export function moisEnLettres(dateIso: string): string {
  const mois = Number.parseInt(dateIso.slice(5, 7), 10);
  const nom = MOIS[mois - 1];
  return nom === undefined ? dateCourte(dateIso) : `${nom} ${dateIso.slice(0, 4)}`;
}

/** « entre janvier 2024 et décembre 2025 ». */
export function libellePeriode(periode: { debut: string; fin: string }): string {
  return `entre ${moisEnLettres(periode.debut)} et ${moisEnLettres(periode.fin)}`;
}

/**
 * « Appartements vendus à Marseille 5e Arrondissement : 1 823 ventes entre janvier 2024 et décembre 2025,
 * médiane 3 423 €/m², la moitié des ventes entre 2 833 €/m² et 4 135 €/m². »
 */
export function phraseRepere(dvf: Dvf, type: TypeBien): string {
  const quoi = type === 'maison' ? 'Maisons vendues' : 'Appartements vendus';
  const ou = dvf.lieu === undefined ? '' : ` à ${dvf.lieu}`;
  const quand = dvf.periode === undefined ? '' : ` ${libellePeriode(dvf.periode)}`;
  const ventes = `${nombre(dvf.nombreVentes)} ${dvf.nombreVentes > 1 ? 'ventes' : 'vente'}`;
  const quartiles =
    dvf.q1M2 === undefined || dvf.q3M2 === undefined
      ? ''
      : `, la moitié des ventes entre ${prixM2(dvf.q1M2)} et ${prixM2(dvf.q3M2)}`;
  return `${quoi}${ou} : ${ventes}${quand}, médiane ${prixM2(dvf.medianM2)}${quartiles}.`;
}

/** « Prix affiché : 2 385 €/m² (155 000 €). » */
export function phrasePrixAffiche(prix: number, surface: number): string {
  return `Prix affiché : ${prixM2(Math.round(prix / surface))} (${euros(prix)}).`;
}
