import { calculerProjet, type AxeVerdict, type Feu, type Resultats } from '@loupe/moteur';

import {
  euros,
  eurosParMois,
  eurosSignes,
  nombre,
  pourcentage,
  pourcentageSigne,
} from '@/formatage/nombres';
import type { ProjetEnregistre, StatutProjet } from '@/stockage/projets';
import { libelleTauxNegociation } from '@/textes/achat';
import { libelleRisques } from '@/textes/feux';
import { MODES, REGIMES } from '@/textes/regimes';

export type CodeIndicateur =
  | 'prix'
  | 'negociation'
  | 'prixM2'
  | 'ecartMarche'
  | 'loyer'
  | 'cashflow'
  | 'brut'
  | 'net'
  | 'effort'
  | 'impot'
  | 'horizon'
  | 'cashNet'
  | 'tri'
  | 'enrichissement'
  | 'risques';

export interface Indicateur {
  readonly code: CodeIndicateur;
  readonly libelle: string;
  /** « haut » : plus c'est haut, mieux c'est ; « bas » : l'inverse. Sert au tri. */
  readonly sens: 'haut' | 'bas';
  /** La meilleure valeur de la ligne est mise en avant (pas pour un prix ou un loyer). */
  readonly meilleur: boolean;
  /** Feu du verdict porté par cette ligne, s'il y en a un. */
  readonly axe?: AxeVerdict;
  readonly extraire: (r: Resultats) => number | null;
  readonly formater: (valeur: number) => string;
  /** Précision affichée sous la valeur (régime retenu, horizon). */
  readonly detail?: (r: Resultats) => string;
}

/** Le verdict porte toujours les cinq axes : leurs valeurs, indexées par axe. */
function valeursDesFeux(r: Resultats): Readonly<Record<AxeVerdict, number | null>> {
  return Object.fromEntries(r.verdict.feux.map((f) => [f.axe, f.valeur])) as Record<
    AxeVerdict,
    number | null
  >;
}

/** Les lignes du tableau, dans l'ordre d'affichage. */
export const INDICATEURS: readonly Indicateur[] = [
  {
    code: 'prix',
    libelle: 'Prix affiché',
    sens: 'bas',
    meilleur: false,
    extraire: (r) => r.achat.prixAffiche,
    formater: euros,
  },
  {
    code: 'negociation',
    libelle: 'Négociation',
    sens: 'haut',
    meilleur: false,
    extraire: (r) => r.achat.negociationTaux,
    formater: (v) => (v === 0 ? 'aucune' : libelleTauxNegociation(v)),
  },
  {
    code: 'prixM2',
    libelle: 'Prix au m²',
    sens: 'bas',
    meilleur: false,
    extraire: (r) => r.achat.prixRetenu / r.projet.bien.surface,
    formater: (v) => `${nombre(v)} €/m²`,
  },
  {
    code: 'ecartMarche',
    libelle: 'Écart avec le prix estimé',
    sens: 'bas',
    meilleur: true,
    axe: 'prix',
    extraire: (r) => valeursDesFeux(r).prix,
    formater: (v) => pourcentageSigne(v),
  },
  {
    code: 'loyer',
    libelle: 'Loyer mensuel hors charges',
    sens: 'haut',
    meilleur: false,
    extraire: (r) => r.cashflow.recettes.loyersBruts / 12,
    formater: euros,
    // Un loyer de colocation ou de courte durée ne se lit qu'avec son type.
    detail: (r) => MODES[r.projet.hypotheses.location.mode],
  },
  {
    code: 'cashflow',
    libelle: 'Cash-flow mensuel',
    sens: 'haut',
    meilleur: true,
    axe: 'cashflow',
    extraire: (r) => r.cashflow.mensuel,
    formater: eurosParMois,
  },
  {
    code: 'brut',
    libelle: 'Rendement brut',
    sens: 'haut',
    meilleur: true,
    extraire: (r) => r.rendement.rendements.brut,
    formater: (v) => pourcentage(v),
  },
  {
    code: 'net',
    libelle: 'Rendement net',
    sens: 'haut',
    meilleur: true,
    axe: 'rendement',
    extraire: (r) => r.rendement.rendements.net,
    formater: (v) => pourcentage(v),
  },
  {
    code: 'effort',
    libelle: 'Effort bancaire',
    sens: 'bas',
    meilleur: true,
    axe: 'effort',
    extraire: (r) => r.financement.effort.hcsf,
    formater: (v) => pourcentage(v, 0),
  },
  {
    code: 'impot',
    libelle: 'Impôt du régime retenu',
    sens: 'bas',
    meilleur: true,
    extraire: (r) => r.fiscalite.regimes[r.fiscalite.retenu].impotTotal,
    formater: euros,
    detail: (r) => `${REGIMES[r.fiscalite.retenu]} · ${String(r.revente.annees)} ans`,
  },
  {
    code: 'horizon',
    libelle: 'Horizon de revente',
    sens: 'haut',
    meilleur: false,
    extraire: (r) => r.revente.annees,
    formater: (v) => `${String(v)} ans`,
  },
  {
    code: 'cashNet',
    libelle: 'Cash net à la revente',
    sens: 'haut',
    meilleur: true,
    extraire: (r) => r.revente.cashNetVendeur,
    formater: euros,
  },
  {
    code: 'tri',
    libelle: 'TRI',
    sens: 'haut',
    meilleur: true,
    extraire: (r) => r.rendement.tri,
    formater: (v) => pourcentage(v),
  },
  {
    code: 'enrichissement',
    libelle: 'Enrichissement',
    sens: 'haut',
    meilleur: true,
    extraire: (r) => r.rendement.enrichissement.total,
    formater: eurosSignes,
  },
  {
    code: 'risques',
    libelle: 'Risques',
    sens: 'bas',
    meilleur: true,
    axe: 'risques',
    extraire: (r) => valeursDesFeux(r).risques,
    formater: libelleRisques,
  },
];

const PAR_CODE = Object.fromEntries(INDICATEURS.map((i) => [i.code, i])) as Readonly<
  Record<CodeIndicateur, Indicateur>
>;

export function indicateurParCode(code: CodeIndicateur): Indicateur {
  return PAR_CODE[code];
}

export interface ColonneComparaison {
  readonly id: string;
  readonly nom: string;
  readonly statut: StatutProjet;
  readonly resultats: Resultats;
  readonly valeurs: Readonly<Record<CodeIndicateur, number | null>>;
  readonly feux: Readonly<Record<AxeVerdict, Feu>>;
}

/** Une colonne par projet, calculée par le moteur (sans scénarios : ~5 ms par projet). */
export function comparerProjets(projets: readonly ProjetEnregistre[]): ColonneComparaison[] {
  return projets.map((p) => {
    const resultats = calculerProjet(p.projet, { avecScenarios: false });
    const valeurs = Object.fromEntries(
      INDICATEURS.map((i) => [i.code, i.extraire(resultats)]),
    ) as Record<CodeIndicateur, number | null>;
    const feux = Object.fromEntries(resultats.verdict.feux.map((f) => [f.axe, f.feu])) as Record<
      AxeVerdict,
      Feu
    >;
    return { id: p.id, nom: p.nom, statut: p.statut, resultats, valeurs, feux };
  });
}

export interface Tri {
  readonly code: CodeIndicateur;
  /** `true` : la pire valeur d'abord. */
  readonly inverse: boolean;
}

/** Réordonne les colonnes selon une ligne, meilleure valeur d'abord ; les absentes en dernier. */
export function trierColonnes(
  colonnes: readonly ColonneComparaison[],
  tri: Tri,
): ColonneComparaison[] {
  const indicateur = indicateurParCode(tri.code);
  const signe = (indicateur.sens === 'haut' ? -1 : 1) * (tri.inverse ? -1 : 1);
  return [...colonnes].sort((a, b) => {
    const va = a.valeurs[tri.code];
    const vb = b.valeurs[tri.code];
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
    return signe * (va - vb);
  });
}

/** Valeurs d'une ligne sont-elles triées en décroissant, pour `aria-sort` ? */
export function triDecroissant(tri: Tri): boolean {
  return (indicateurParCode(tri.code).sens === 'haut') !== tri.inverse;
}

/** La meilleure valeur d'une ligne, ou `null` si la ligne n'en met pas en avant. */
export function meilleureValeur(
  colonnes: readonly ColonneComparaison[],
  indicateur: Indicateur,
): number | null {
  if (!indicateur.meilleur) return null;
  const valeurs = colonnes
    .map((c) => c.valeurs[indicateur.code])
    .filter((v): v is number => v !== null);
  const plusHaute = Math.max(...valeurs);
  const plusBasse = Math.min(...valeurs);
  // Aucune valeur, ou toutes égales : aucune n'est meilleure que les autres.
  if (valeurs.length === 0 || plusHaute === plusBasse) return null;
  return indicateur.sens === 'haut' ? plusHaute : plusBasse;
}

export const MIN_COMPARES = 2;
export const MAX_COMPARES = 5;

/** Les projets cochés d'office : les premiers non écartés, jusqu'à cinq (tous s'il en manque). */
export function selectionInitiale(projets: readonly ProjetEnregistre[]): string[] {
  const actifs = projets.filter((p) => p.statut !== 'ecarte');
  const base = actifs.length >= MIN_COMPARES ? actifs : projets;
  return base.slice(0, MAX_COMPARES).map((p) => p.id);
}
