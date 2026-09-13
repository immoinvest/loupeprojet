import type { Regles } from './types';

/**
 * Règles connues au 13 septembre 2026.
 * Sources : .product/functional-spec.md (section « Moteur de calcul ») et ses liens.
 * Toute valeur marquée dans `aConfirmer` attend une source officielle consolidée.
 */
export const regles202609: Regles = {
  version: '2026-09',
  dateReference: '2026-09-13',

  acquisition: {
    // Taux départemental relevé à 5 % par la plupart des départements (LF 2025, jusqu'au 31/03/2028).
    dmtoDefaut: 0.05,
    // Départements restés au taux de base historique (3,80 %). Liste à confirmer.
    dmtoParDepartement: { '36': 0.038, '56': 0.038, '976': 0.038 },
    taxeCommunale: 0.012,
    fraisAssiette: 0.0237,
    emoluments: [
      { jusqua: 6_500, taux: 0.0387 },
      { jusqua: 17_000, taux: 0.01596 },
      { jusqua: 60_000, taux: 0.01064 },
      { jusqua: null, taux: 0.00799 },
    ],
    tva: 0.2,
    contributionSecuriteImmobiliere: 0.001,
    debours: 0.004,
  },

  credit: {
    // Crédit Logement / CSA, moyennes d'août 2026.
    tauxMoyens: { '15': 0.0314, '20': 0.0327, '25': 0.0335 },
    // Banque de France, T3 2026, prêts à taux fixe de 20 ans et plus.
    tauxUsure: 0.0529,
    hcsf: {
      seuilEffort: 0.35,
      partLoyers: 0.7,
      dureeMaxAnnees: 25,
      dureeMaxTravauxAnnees: 27,
      seuilTravauxPourDureeMax: 0.1,
    },
    ira: { moisInterets: 6, plafondCapital: 0.03 },
  },

  exploitation: {
    primeMeuble: 0.15,
    primeColocation: 0.35,
    vacanceSemainesColocation: 4,
    interdictionLocationDpe: { G: 2025, F: 2028, E: 2034 },
  },

  fiscalite: {
    prelevementsSociaux: {
      // LFSS 2026 : CSG 10,6 % sur les BIC non professionnels → 18,6 %. À confirmer.
      bic: 0.186,
      foncier: 0.172,
      plusValue: 0.172,
    },
    microBic: {
      abattement: 0.5,
      abattementTourismeNonClasse: 0.3,
      // Seuil 2026-2028.
      plafond: 83_600,
      plafondTourismeNonClasse: 15_000,
    },
    microFoncier: { abattement: 0.3, plafond: 15_000 },
    deficitFoncier: {
      plafondRevenuGlobal: 10_700,
      // Rénovation énergétique, jusqu'au 31/12/2027.
      plafondRenovationEnergetique: 21_400,
      reportAnnees: 10,
    },
    deficitBic: { reportAnnees: 10 },
    amortissement: {
      partTerrain: 0.15,
      // Décomposition simplifiée à deux composants (voir ADR-M4).
      composants: [
        { code: 'grosOeuvre', part: 0.55, dureeAnnees: 50 },
        { code: 'secondOeuvre', part: 0.45, dureeAnnees: 20 },
      ],
      travauxDureeAnnees: 10,
      mobilierDureeAnnees: 7,
    },
    plusValue: {
      tauxIr: 0.19,
      forfaitFrais: 0.075,
      forfaitTravaux: 0.15,
      forfaitTravauxDesAnnee: 5,
      // Exonération d'IR au bout de 22 ans.
      abattementIr: [
        { deAnnee: 6, aAnnee: 21, tauxParAn: 0.06 },
        { deAnnee: 22, aAnnee: 22, tauxParAn: 0.04 },
      ],
      // Exonération de prélèvements sociaux au bout de 30 ans.
      abattementPs: [
        { deAnnee: 6, aAnnee: 21, tauxParAn: 0.0165 },
        { deAnnee: 22, aAnnee: 22, tauxParAn: 0.016 },
        { deAnnee: 23, aAnnee: 30, tauxParAn: 0.09 },
      ],
      surtaxeSeuil: 50_000,
      // Barème appliqué à la plus-value nette imposable, sans lissage (simplification).
      surtaxe: [
        { jusqua: 50_000, taux: 0 },
        { jusqua: 100_000, taux: 0.02 },
        { jusqua: 150_000, taux: 0.03 },
        { jusqua: 200_000, taux: 0.04 },
        { jusqua: 250_000, taux: 0.05 },
        { jusqua: null, taux: 0.06 },
      ],
    },
  },

  verdict: {
    prix: { bonJusqua: -0.05, surveillerJusqua: 0.05 },
    rendementNet: { bonDes: 0.055, surveillerDes: 0.04 },
    cashflowMensuel: { bonDes: 0, surveillerDes: -100 },
    effort: { bonJusqua: 0.33, surveillerJusqua: 0.35 },
  },

  aConfirmer: ['fiscalite.prelevementsSociaux.bic', 'acquisition.dmtoParDepartement'],
  simplifications: [
    'Amortissement du bâti en deux composants (55 % / 50 ans, 45 % / 20 ans)',
    'Frais d’acquisition passés en charge la première année au réel meublé',
    'Surtaxe sur les plus-values élevées appliquée par tranche, sans lissage',
    'Recettes BIC = loyers hors charges (charges refacturées ignorées)',
    'Intérêts capitalisés pendant un différé total non déduits fiscalement',
    'Rendement net et net-net calculés sur la première année pleine',
    'Scénario colocation : loyer total +35 % et 4 semaines de vacance, sans travaux d’aménagement',
  ],
};
