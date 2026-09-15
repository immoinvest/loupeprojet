import {
  CASES_FONCIER,
  CASES_MEUBLE,
  LIGNES_2044,
  type EcartPoste,
  type LigneCharges2044,
  type PosteReel,
  type RaisonNonReportee,
  type RaisonSansPrevu,
} from '@loupe/gestion';
import type { Regime } from '@loupe/moteur';

import { montant } from '@/gestion/format';

/** Textes de la déclaration, de l'export de l'année et du réel contre prévu (tutoiement, comme Gérer). */

export const TEXTES_DECLARATION = {
  titre: 'Déclaration',
  annee: 'Revenus de l’année',
  exporter: 'Exporter l’année (CSV)',
  recapitulatif: 'Récapitulatif imprimable',
  imprimer: 'Imprimer',
  apercu: 'Aperçu : imprime-le ou enregistre-le en PDF pour ton comptable.',
  retour: 'Déclaration',
  avertissement:
    'Deklic prépare les montants à reporter à partir de ce que tu as saisi dans Gérer ; il ne déclare rien à ta place. Vérifie-les avec la notice de l’année, surtout si ton foyer a d’autres revenus locatifs.',
  casesAConfirmer:
    'Numéros relevés sur la notice 2026 (revenus 2025) : à confirmer avec la notice de ton année.',
  casesVerifiees: 'Numéros relevés sur la notice 2026 (revenus 2025) et le site impots.gouv.fr.',
  foncierTitre: 'Biens loués vides : revenus fonciers',
  meubleTitre: 'Biens meublés : location meublée non professionnelle',
  aucunBien: 'Ajoute un bien dans Gérer pour préparer ta déclaration.',
  retenu: 'choisi dans ton analyse',
  recettes: 'Loyers encaissés hors charges',
  recettesMeuble: 'Recettes encaissées, charges comprises',
  abattement: 'Abattement',
  imposable: 'Revenu imposable',
  aReporter: 'À reporter',
  plafondDepasse:
    'Ces recettes dépassent le plafond du régime : il ne s’applique pas, déclare au réel.',
  plafondFoyer:
    'Le plafond s’apprécie sur tout ton foyer : ajoute les revenus locatifs que Deklic ne connaît pas.',
  lmnpReel:
    'Au réel, le résultat dépend des amortissements et de la liasse 2031 : confie-le à un expert-comptable. Voici tes recettes de l’année.',
  resultat: 'Résultat (ligne 420)',
  totalCharges: 'Total des frais et charges (ligne 240)',
  interets: 'Intérêts et assurance d’emprunt',
  deficitExplication:
    'Un déficit va sur le revenu global dans la limite du plafond, le reste sur les revenus fonciers des dix années suivantes.',
  nonReporteesTitre: 'Dépenses non reportées au réel',
  nonReporteesTexte:
    'Deklic ne sait pas où les placer : regarde-les avec la notice ou ton comptable.',
  exportTitre: 'Pour ton comptable',
  exportTexte:
    'Tous les loyers, dépenses et échéances de prêt de l’année, dans un fichier que ton tableur ouvre en colonnes.',
  aucunMouvement: 'Aucun mouvement enregistré sur cette année.',
  recapTitre: 'Récapitulatif de l’année',
  recapParBien: 'Par bien',
  recapMouvements: 'Les mouvements',
} as const;

export const NOMS_REGIMES_DECLARATION: Readonly<Record<Regime, string>> = {
  micro_foncier: 'Micro-foncier',
  nu_reel: 'Réel (déclaration 2044)',
  micro_bic: 'Micro-BIC',
  lmnp_reel: 'LMNP au réel',
};

export const LIBELLES_LIGNES: Readonly<Record<LigneCharges2044, string>> = {
  fraisGestion: 'Frais d’administration et de gestion',
  forfaitGestion: 'Autres frais de gestion (20 € par local)',
  assurance: 'Primes d’assurance',
  travaux: 'Réparation, entretien et amélioration',
  taxeFonciere: 'Taxe foncière',
  copropriete: 'Provisions de copropriété',
};

export const RAISONS_NON_REPORTEES: Readonly<Record<RaisonNonReportee, string>> = {
  credit: 'Crédit : saisis le prêt du bien, ses intérêts iront en ligne 250',
  autre: 'Autre : catégorie à préciser',
  sans_bien: 'Commune à tous les biens : à répartir',
};

/** « Déclaration 2027 (revenus 2026) ». */
export function titreDeclaration(anneeRevenus: number): string {
  return `Déclaration ${String(anneeRevenus + 1)} (revenus ${String(anneeRevenus)})`;
}

/** « ligne 224 » ; « ligne 224 (à confirmer) » quand la notice de l'année n'a pas été relue. */
export function ligne2044(cle: keyof typeof LIGNES_2044, verifiee: boolean): string {
  return avecConfirmation(`ligne ${LIGNES_2044[cle]}`, verifiee);
}

/** « case 4BE » ; « case 4BE (à confirmer) ». */
export function caseFoncier(cle: keyof typeof CASES_FONCIER, verifiee: boolean): string {
  return avecConfirmation(`case ${CASES_FONCIER[cle]}`, verifiee);
}

/** « case 5NI (5OI pour le déclarant 2) » ; avec « (à confirmer) ». */
export function caseMicroBic(verifiee: boolean): string {
  return avecConfirmation(
    `case ${CASES_MEUBLE.microBic} (${CASES_MEUBLE.microBicDeclarant2} pour le déclarant 2)`,
    verifiee,
  );
}

function avecConfirmation(texte: string, verifiee: boolean): string {
  return verifiee ? texte : `${texte} (à confirmer)`;
}

/** 0,3 → « 30 % ». */
export function tauxEntier(taux: number): string {
  return `${String(Math.round(taux * 100))} %`;
}

/** « Plafond : 15 000 € de recettes ». */
export function plafondDuRegime(centimes: number): string {
  return `Plafond : ${montant(centimes)} de recettes`;
}

/** « Tu peux imputer au plus 10 700 € sur ton revenu global. » */
export function plafondDeficit(centimes: number): string {
  return `Au plus ${montant(centimes)} de déficit sur ton revenu global.`;
}

/** Le nom du fichier de l'export : « deklic-gestion-2026.csv ». */
export function nomFichierExport(annee: number): string {
  return `deklic-gestion-${String(annee)}.csv`;
}

/* --- Export CSV --- */

export const EN_TETE_EXPORT: readonly string[] = [
  'Date',
  'Bien',
  'Catégorie',
  'Libellé',
  'Montant',
  'Source',
];

export const TEXTES_EXPORT_ANNEE = {
  loyer: 'Loyer',
  interets: 'Intérêts d’emprunt',
  capital: 'Capital remboursé',
  assurance: 'Assurance emprunteur',
  tousLesBiens: 'Tous les biens',
  sourceLoyer: 'Loyer reçu',
  sourceDepense: 'Dépense saisie',
  sourcePret: 'Tableau d’amortissement',
  recuperable: 'récupérable',
} as const;

/** « de mars 2026 », « d’août 2026 », « d’octobre 2026 ». */
export function deMois(mois: string): string {
  return /^[aeiou]/i.test(mois) ? `d’${mois}` : `de ${mois}`;
}

/** « Loyer de mars 2026 · Julie Martin » (sans locataire connu : « Loyer de mars 2026 »). */
export function libelleLoyer(mois: string, locataire: string | null): string {
  const loyer = `Loyer ${deMois(mois)}`;
  return locataire === null ? loyer : `${loyer} · ${locataire}`;
}

/** « Échéance de mars 2026 », « Échéance d’octobre 2026 ». */
export function libelleEcheance(mois: string): string {
  return `Échéance ${deMois(mois)}`;
}

/* --- Réel contre prévu --- */

export const TEXTES_REEL_PREVU = {
  titre: 'Réel contre prévu',
  analyser: 'Analyser ce bien',
  sansAnalyse:
    'Ce bien n’a pas d’analyse. Analyse-le pour savoir ce qu’il devrait rapporter et le comparer au réel.',
  voirAnalyse: 'Voir l’analyse',
  tropTot: 'Il faut au moins un mois complet de gestion pour comparer : reviens le mois prochain.',
  prevu: 'Prévu',
  reel: 'Réel',
  cashflow: 'Cash-flow par mois',
  conforme: 'Conforme au prévu',
  principaux: 'Ce qui fait la différence',
} as const;

export const RAISONS_SANS_PREVU: Readonly<Record<RaisonSansPrevu, string>> = {
  sans_analyse: TEXTES_REEL_PREVU.sansAnalyse,
  illisible: 'L’analyse de ce bien ne peut plus être relue : rien à comparer.',
  sans_loyer: 'L’analyse de ce bien n’avait pas de loyer : rien à comparer.',
};

export const NOMS_POSTES: Readonly<Record<PosteReel, string>> = {
  loyers: 'Loyers encaissés',
  mensualites: 'Mensualités de prêt',
  taxe_fonciere: 'Taxe foncière',
  copropriete: 'Copropriété',
  assurance: 'Assurance',
  travaux: 'Travaux',
  entretien: 'Entretien',
  gestion: 'Gestion et comptable',
  autre: 'Autres dépenses',
};

/** Un montant par mois arrondi à l'euro : « 38 € ». */
function euroParMois(centimes: number): string {
  return montant(Math.round(Math.abs(centimes) / 100) * 100);
}

/** « 38 €/mois de moins que prévu », « 12 €/mois de plus que prévu », ou « Conforme au prévu » sous 1 €. */
export function titreEcart(ecart: number): string {
  if (Math.abs(ecart) < 100) return TEXTES_REEL_PREVU.conforme;
  return `${euroParMois(ecart)}/mois de ${ecart < 0 ? 'moins' : 'plus'} que prévu`;
}

/** « Loyers encaissés : 40 €/mois de moins » ; « Taxe foncière : 14 €/mois de plus ». */
export function phraseEcart(ecart: EcartPoste): string {
  // Un loyer plus bas et une dépense plus haute pèsent tous deux sur le cash-flow.
  const plus = ecart.poste === 'loyers' ? ecart.effet > 0 : ecart.effet < 0;
  return `${NOMS_POSTES[ecart.poste]} : ${euroParMois(ecart.effet)}/mois de ${plus ? 'plus' : 'moins'}`;
}

/** « Moyenne de 5 mois complets, avant impôt, contre l'analyse recalculée avec ses règles (2026-09). » */
export function explicationReelPrevu(mois: number, versionRegles: string): string {
  const duree = mois === 1 ? '1 mois complet' : `${String(mois)} mois complets`;
  return `Moyenne de ${duree}, avant impôt, contre l’analyse recalculée avec ses règles (${versionRegles}).`;
}
