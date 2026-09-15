/*
 * Règles de la vie du bail, datées et sourcées (vérifiées le 15/09/2026). Une valeur non vérifiée sur
 * sa source porte `aConfirmer: true` et le dit à l'écran.
 */

export const CLASSES_DPE = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
export type ClasseDpe = (typeof CLASSES_DPE)[number];

/**
 * Forme du bail : `etudiant` (meublé de 9 mois, loi n° 89-462 art. 25-7) et `mobilite` (1 à 10 mois,
 * titre I ter) ont une fin prévue dont Deklic prévient ; `classique` se reconduit.
 */
export const FORMES_BAIL = ['classique', 'etudiant', 'mobilite'] as const;
export type FormeBail = (typeof FORMES_BAIL)[number];

/** Une valeur de l'indice de référence des loyers : trimestre « AAAA-Tn », indice en centièmes entiers. */
export interface ValeurIrl {
  readonly trimestre: string;
  /** 148,37 → 14 837. */
  readonly valeur: number;
  /** Jour de publication par l'INSEE. */
  readonly publieLe: string;
}

/**
 * IRL France métropolitaine, du plus ancien au plus récent (INSEE, série 001515333 ; valeurs de
 * l'Informations rapides n° 167 du 10/07/2026 ; dates de publication relevées dans le tableau de l'IRL
 * de l'ANIL). À compléter chaque trimestre : un indice absent est « attendu », jamais inventé.
 */
export const IRL: readonly ValeurIrl[] = [
  { trimestre: '2022-T1', valeur: 13_393, publieLe: '2022-04-15' },
  { trimestre: '2022-T2', valeur: 13_584, publieLe: '2022-07-13' },
  { trimestre: '2022-T3', valeur: 13_627, publieLe: '2022-10-14' },
  { trimestre: '2022-T4', valeur: 13_726, publieLe: '2023-01-13' },
  { trimestre: '2023-T1', valeur: 13_861, publieLe: '2023-04-14' },
  { trimestre: '2023-T2', valeur: 14_059, publieLe: '2023-07-13' },
  { trimestre: '2023-T3', valeur: 14_103, publieLe: '2023-10-13' },
  { trimestre: '2023-T4', valeur: 14_206, publieLe: '2024-01-16' },
  { trimestre: '2024-T1', valeur: 14_346, publieLe: '2024-04-12' },
  { trimestre: '2024-T2', valeur: 14_517, publieLe: '2024-07-12' },
  { trimestre: '2024-T3', valeur: 14_451, publieLe: '2024-10-15' },
  { trimestre: '2024-T4', valeur: 14_464, publieLe: '2025-01-15' },
  { trimestre: '2025-T1', valeur: 14_547, publieLe: '2025-04-15' },
  { trimestre: '2025-T2', valeur: 14_668, publieLe: '2025-07-11' },
  { trimestre: '2025-T3', valeur: 14_577, publieLe: '2025-10-15' },
  { trimestre: '2025-T4', valeur: 14_578, publieLe: '2026-01-15' },
  { trimestre: '2026-T1', valeur: 14_660, publieLe: '2026-04-15' },
  { trimestre: '2026-T2', valeur: 14_837, publieLe: '2026-07-10' },
];

export const SOURCE_IRL = {
  libelle: 'INSEE, indice de référence des loyers (série 001515333)',
  url: 'https://www.insee.fr/fr/statistiques/9022797',
  consulteLe: '2026-09-15',
  /** Prochaine publication annoncée par l'INSEE (3e trimestre 2026). */
  prochainePublication: '2026-10-15',
  aConfirmer: false,
} as const;

/** Mois habituel de publication de chaque trimestre (T4 : janvier de l'année suivante). */
export const MOIS_PUBLICATION_IRL: Readonly<Record<1 | 2 | 3 | 4, number>> = {
  1: 4,
  2: 7,
  3: 10,
  4: 1,
};

/** Jour retenu pour estimer la publication d'un indice absent du tableau (l'INSEE publie vers le 15). */
export const JOUR_PUBLICATION_ESTIME = 15;

/** Une classe exclue de la location décente à partir d'une date. */
export interface EcheanceDecence {
  readonly classe: ClasseDpe;
  readonly aPartirDu: string;
}

/**
 * Niveau de performance minimal d'un logement décent (loi n° 89-462 du 6 juillet 1989, art. 6, rédaction
 * de la loi n° 2021-1104 « Climat et résilience ») : une classe et les classes moins bonnes sont exclues
 * à partir de la date. S'applique aux baux conclus, renouvelés ou reconduits à partir de cette date.
 */
export const DECENCE_ENERGETIQUE: {
  readonly metropole: readonly EcheanceDecence[];
  readonly outreMer: readonly EcheanceDecence[];
  readonly source: string;
  readonly consulteLe: string;
  readonly aSuivre: boolean;
  readonly aConfirmer: boolean;
} = {
  metropole: [
    { classe: 'G', aPartirDu: '2025-01-01' },
    { classe: 'F', aPartirDu: '2028-01-01' },
    { classe: 'E', aPartirDu: '2034-01-01' },
  ],
  /** Guadeloupe, Martinique, Guyane, La Réunion, Mayotte. */
  outreMer: [
    { classe: 'G', aPartirDu: '2028-01-01' },
    { classe: 'F', aPartirDu: '2031-01-01' },
  ],
  source: 'Loi n° 89-462 du 6 juillet 1989, art. 6 (loi n° 2021-1104, art. 160)',
  consulteLe: '2026-09-15',
  /** Projet de loi « relance logement » adopté par le Sénat le 08/07/2026, pas encore par l'Assemblée. */
  aSuivre: true,
  aConfirmer: false,
};

/** Codes postaux des départements d'outre-mer régis par l'article 73 de la Constitution. */
export const PREFIXES_OUTRE_MER = ['971', '972', '973', '974', '976'] as const;

/**
 * Gel des loyers : ni révision ni majoration dans un logement de classe F ou G (art. 17-1 III, loi
 * n° 2021-1104, art. 159 ; baux conclus, renouvelés ou reconduits depuis le 24/08/2022 en métropole,
 * le 01/07/2024 outre-mer). Deklic ne propose jamais de hausse pour ces classes.
 */
export const GEL_LOYERS = {
  classes: ['F', 'G'] as readonly ClasseDpe[],
  depuis: '2022-08-24',
  source: 'Loi n° 89-462 du 6 juillet 1989, art. 17-1 III',
  aConfirmer: false,
} as const;

/**
 * Validité du DPE : 10 ans, sauf les DPE réalisés avant la réforme du 1er juillet 2021 (ministère de la
 * Transition écologique, « Diagnostic de performance énergétique », consulté le 15/09/2026).
 */
export const VALIDITE_DPE = {
  annees: 10,
  anciens: [
    { du: '2013-01-01', au: '2017-12-31', valableJusquau: '2022-12-31' },
    { du: '2018-01-01', au: '2021-06-30', valableJusquau: '2024-12-31' },
  ],
  source: 'Ministère de la Transition écologique, page « Diagnostic de performance énergétique »',
  aConfirmer: false,
} as const;

/** La révision est proposée un mois avant la date anniversaire (choix Deklic, fiche B1). */
export const PREVENANCE_REVISION_JOURS = 30;

/** La fin d'un bail étudiant ou mobilité est signalée un mois avant (choix Deklic). */
export const PREVENANCE_FIN_BAIL_JOURS = 30;
