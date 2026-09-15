import { GROUPES, TOUS_LES_GROUPES } from './descripteurs';
import type { Descripteur } from './types';

/** Les volets d'un projet, dans l'ordre de la bande (`rapport` = la route index). */
export const VOLETS = [
  'rapport',
  'adresse',
  'financement',
  'hypotheses',
  'fiscalite',
  'revente',
  'visite',
] as const;
export type Volet = (typeof VOLETS)[number];

/** D'où l'on vient : un volet du projet, ou le tableau Comparer. */
export type Origine = Volet | 'comparer';

/**
 * Les hypothèses dont un volet affiche un chiffre cliquable (`ValeurHypothese`). Source de
 * « Utilisé par » dans Hypothèses : un chiffre lié absent d'ici ne compile pas (`CheminLie`).
 */
export const CHIFFRES_PAR_VOLET = {
  rapport: [
    'hypotheses.achat.prix',
    'hypotheses.location.loyerHc',
    'hypotheses.location.loyerChambre',
    'hypotheses.location.nuitee',
    'hypotheses.location.vacanceSemaines',
    'hypotheses.charges.taxeFonciere',
    'hypotheses.pret.tauxNominal',
    'hypotheses.fiscalite.regime',
    'hypotheses.fiscalite.tmi',
    'hypotheses.revente.annees',
  ],
  adresse: [
    'bien.etat',
    'bien.dpe',
    'bien.etage',
    'bien.exterieur',
    'bien.venduLoue',
    'hypotheses.charges.coproAnnuel',
  ],
  financement: [
    'hypotheses.achat.prix',
    'hypotheses.achat.travaux',
    'hypotheses.achat.mobilier',
    'hypotheses.pret.apport',
    'hypotheses.pret.tauxAssurance',
    'hypotheses.pret.fraisDossier',
    'hypotheses.location.loyerHc',
    'hypotheses.location.loyerChambre',
    'hypotheses.location.nuitee',
  ],
  hypotheses: [],
  fiscalite: [
    'hypotheses.fiscalite.regime',
    'hypotheses.fiscalite.tmi',
    'hypotheses.revente.annees',
  ],
  revente: [
    'hypotheses.revente.annees',
    'hypotheses.revente.evolutionAnnuelle',
    'hypotheses.revente.fraisAgenceTaux',
    'hypotheses.achat.prix',
    'hypotheses.achat.travaux',
  ],
  visite: [],
} as const satisfies Readonly<Record<Volet, readonly string[]>>;

/** Les hypothèses cliquables du tableau Comparer (un lien par projet). */
export const CHIFFRES_COMPARER = [
  'hypotheses.achat.prix',
  'hypotheses.achat.negociationTaux',
  'hypotheses.location.loyerHc',
  'hypotheses.location.loyerChambre',
  'hypotheses.location.nuitee',
  'hypotheses.revente.annees',
  'hypotheses.fiscalite.regime',
] as const;

export type CheminLie =
  (typeof CHIFFRES_PAR_VOLET)[Volet][number] | (typeof CHIFFRES_COMPARER)[number];

/** Le descripteur d'un champ éditable, ou `null` : jamais d'exception sur une adresse forgée. */
export function descripteurLie(chemin: string): Descripteur | null {
  for (const groupe of TOUS_LES_GROUPES) {
    const trouve = groupe.champs.find((d) => d.chemin === chemin);
    if (trouve !== undefined) return trouve;
  }
  return null;
}

const DANS_HYPOTHESES = new Set(GROUPES.flatMap((g) => g.champs.map((d) => d.chemin)));

/**
 * Le volet qui porte le champ : Financement pour le prêt (plus dans Hypothèses), Revente pour
 * l'horizon (son curseur), Hypothèses pour tout le reste.
 */
export function voletPour(chemin: string): Volet {
  if (chemin === 'hypotheses.revente.annees') return 'revente';
  if (chemin.startsWith('hypotheses.pret.')) return 'financement';
  return 'hypotheses';
}

/** Segment d'adresse d'un volet : le Rapport est la route index du projet. */
export function segmentDe(volet: Volet): string {
  return volet === 'rapport' ? '' : volet;
}

/** Les volets qui affichent un chiffre de cette hypothèse, dans l'ordre de la bande. */
export function utilisePar(chemin: string): readonly Volet[] {
  return VOLETS.filter((v) => (CHIFFRES_PAR_VOLET[v] as readonly string[]).includes(chemin));
}

export interface Depuis {
  readonly pathname: string;
  readonly origine: Origine;
  readonly chemin: string;
}

export interface LienHypothese {
  readonly pathname: string;
  readonly hash: string;
  readonly state: { readonly depuis: Depuis } | null;
}

/** L'adresse d'une hypothèse : le volet qui la porte, le champ en fragment, l'origine dans l'état. */
export function lienHypothese(
  projetId: string,
  chemin: string,
  origine?: { readonly pathname: string; readonly origine: Origine },
): LienHypothese {
  // Le volet porteur n'est jamais le Rapport : son segment n'est jamais vide.
  return {
    pathname: `/projets/${encodeURIComponent(projetId)}/${segmentDe(voletPour(chemin))}`,
    hash: `#${chemin}`,
    state: origine === undefined ? null : { depuis: { ...origine, chemin } },
  };
}

/** Le champ visé par un fragment (« #hypotheses.location.loyerHc »), s'il est éditable. */
export function cheminDepuisFragment(hash: string): string | null {
  let chemin: string;
  try {
    chemin = decodeURIComponent(hash.replace(/^#/, ''));
  } catch {
    return null;
  }
  return descripteurLie(chemin) === null ? null : chemin;
}

const ADRESSE_PROJET = /^\/projets\/[^/]+(?:\/([^/]+))?\/?$/;

/** L'origine d'une adresse : un volet de projet, Comparer, ou rien. */
export function origineDepuisChemin(pathname: string): Origine | null {
  if (pathname === '/comparer') return 'comparer';
  const correspondance = ADRESSE_PROJET.exec(pathname);
  if (correspondance === null) return null;
  const segment = correspondance[1] ?? '';
  const volet = VOLETS.find((v) => segmentDe(v) === segment);
  return volet ?? null;
}

const ORIGINES: readonly string[] = [...VOLETS, 'comparer'];

const estObjet = (v: unknown): v is Readonly<Record<string, unknown>> =>
  typeof v === 'object' && v !== null;

/** L'origine portée par l'état d'historique ; `null` si absente ou mal formée. */
export function lireDepuis(state: unknown): Depuis | null {
  if (!estObjet(state) || !estObjet(state.depuis)) return null;
  const { pathname, origine, chemin } = state.depuis;
  if (typeof pathname !== 'string' || typeof chemin !== 'string') return null;
  if (typeof origine !== 'string' || !ORIGINES.includes(origine)) return null;
  return { pathname, origine: origine as Origine, chemin };
}

/** Champ introuvable dans le volet courant : Hypothèses s'il y vit et qu'on n'y est pas déjà. */
export function voletDeRepli(chemin: string, courant: Volet): Volet | null {
  return courant !== 'hypotheses' && DANS_HYPOTHESES.has(chemin) ? 'hypotheses' : null;
}
