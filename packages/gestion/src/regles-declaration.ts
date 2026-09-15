/*
 * Aide à la déclaration des revenus locatifs (G5-3, ADR-G37). Les taux, abattements et plafonds
 * viennent des règles fiscales versionnées du moteur (`obtenirRegles`) ; ce fichier ne garde que les
 * numéros de lignes et de cases et deux montants de la notice, vérifiés le 16/09/2026 :
 *
 * - formulaire n° 2044 (2025) : https://www.impots.gouv.fr/sites/default/files/formulaires/2044/2025/2044_5132.pdf
 * - notice n° 2044 (2026, revenus 2025) : https://www.impots.gouv.fr/sites/default/files/formulaires/2044/2026/2044_5487.pdf
 * - micro-foncier, case 4BE : https://www.impots.gouv.fr/particulier/questions/je-mets-en-location-un-logement-vide-comment-declarer-les-loyers-percus
 * - frais d'emprunt ligne 250 : https://www.impots.gouv.fr/particulier/questions/jai-achete-un-logement-que-je-loue-puis-je-deduire-les-interets-demprunt-lies
 * - location meublée, cases 5NG à 5PI, 5NA, 5NY, abattement minimum de 305 € : https://www.impots.gouv.fr/particulier/location-meublee (modifiée le 23/04/2026)
 *
 * Pour toute autre année de revenus que `ANNEE_REVENUS_VERIFIEE`, les numéros s'affichent « à
 * confirmer » tant que la notice de l'année n'a pas été relue.
 */

/** L'année de revenus dont la notice a été relue (déclaration de 2026). */
export const ANNEE_REVENUS_VERIFIEE = 2025;

/** Les lignes de la déclaration n° 2044 (revenus fonciers au réel). */
export const LIGNES_2044 = {
  /** Loyers bruts encaissés. */
  loyers: '211',
  /** Frais d'administration et de gestion (honoraires et commissions versés à un tiers). */
  fraisGestion: '221',
  /** Autres frais de gestion : forfait par local. */
  forfaitGestion: '222',
  /** Primes d'assurance. */
  assurance: '223',
  /** Dépenses de réparation, d'entretien et d'amélioration. */
  travaux: '224',
  /** Taxes foncières et taxes annexes. */
  taxeFonciere: '227',
  /** Provisions pour charges de copropriété payées. */
  copropriete: '229',
  /** Total des frais et charges. */
  totalCharges: '240',
  /** Intérêts d'emprunt (et frais d'emprunt). */
  interets: '250',
  /** Résultat : bénéfice ou déficit. */
  resultat: '420',
} as const;
export type Ligne2044 = keyof typeof LIGNES_2044;

/** Les cases de la déclaration n° 2042 pour les revenus fonciers. */
export const CASES_FONCIER = {
  microFoncier: '4BE',
  benefice: '4BA',
  /** Déficit imputable sur le revenu global (lignes 436 ou 441 de la 2044). */
  deficitRevenuGlobal: '4BC',
  /** Déficit imputable sur les revenus fonciers des années suivantes (lignes 439 ou 442). */
  deficitRevenusFonciers: '4BB',
} as const;

/** Les cases de la déclaration n° 2042-C-PRO pour la location meublée non professionnelle. */
export const CASES_MEUBLE = {
  /** Micro-BIC, « autres locations meublées » (déclarant 1 ; 5OI déclarant 2). */
  microBic: '5NI',
  microBicDeclarant2: '5OI',
  /** Réel : bénéfice et déficit (déclarant 1). */
  reelBenefice: '5NA',
  reelDeficit: '5NY',
} as const;

/** Ligne 222 : 20 € par local donné en location, en centimes. */
export const FORFAIT_GESTION_PAR_LOCAL = 2_000;

/** Micro-BIC : l'abattement forfaitaire ne descend pas sous 305 €, en centimes. */
export const ABATTEMENT_MINIMUM_MICRO_BIC = 30_500;
