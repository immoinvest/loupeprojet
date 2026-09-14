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
    // Choix Deklic, aligné sur le HCSF : la banque compte 70 % des loyers comme revenu (le reste
    // absorbe charges et vacance). Mensualité ≤ 70 % du loyer : le loyer porte le crédit dans la
    // lecture de la banque ; ≤ 100 % : le loyer couvre encore la mensualité ; au-delà : problème.
    couverture: { bonJusqua: 0.7, surveillerJusqua: 1 },
  },

  visite: {
    // Diagnostic amiante : permis de construire avant le 1er juillet 1997 (art. L1334-13 du Code de la santé publique).
    amianteAvantAnnee: 1997,
    // Constat de risque d'exposition au plomb : construction avant le 1er janvier 1949 (art. L1334-5).
    plombAvantAnnee: 1949,
    // Diagnostics électricité et gaz : installations de plus de 15 ans (art. L134-7 et L134-6 du CCH).
    installationsAnciennesAns: 15,
    // Choix Deklic, aligné sur les coefficients d'étage de l'estimation.
    etageSansAscenseur: 3,
    // Décence : 9 m² de surface habitable pour la pièce principale (décret 2002-120, art. 4), appliqué à chaque chambre.
    chambreColocationM2: 9,
  },

  estimation: {
    // DVF ne dit rien de l'état : un bien à rénover se vend dans le bas des ventes comparables,
    // un bien rénové dans le haut (choix Deklic).
    positionsEtat: { a_renover: 0.25, a_rafraichir: 0.375, bon_etat: 0.5, renove: 0.75 },
    // Notaires de France, « La valeur verte des logements en France sur les transactions 2024 »
    // (janvier 2026), écarts à la classe D. F n'est pas publiée à part : l'écart de G est repris.
    // Maisons : seule G est publiée ; les autres classes restent sans correction.
    dpe: {
      appartement: { A: 0.16, B: 0.12, C: 0.06, D: 0, E: -0.04, F: -0.12, G: -0.12 },
      maison: { A: null, B: null, C: null, D: 0, E: null, F: -0.25, G: -0.25 },
    },
    // MeilleursAgents (juin 2017), grandes villes de province, par rapport au 2e étage.
    etage: {
      avecAscenseur: { rezDeChaussee: -0.099, hautsAPartirDe: 4, hauts: 0.04 },
      sansAscenseur: { rezDeChaussee: -0.096, hautsAPartirDe: 3, hauts: -0.009 },
    },
    // MeilleursAgents (mai 2020), onze plus grandes villes : balcon ou terrasse +8,8 %.
    exterieur: 0.088,
    // Observatoire des charges de copropriété ARC/UNARC, 2024 : 26 €/m²/an en moyenne en France.
    // L'écart est capitalisé au rendement locatif brut local, borné à ±15 % (choix Deklic).
    charges: { repereM2An: 26, borne: 0.15 },
    // Choix Deklic (14/09/2026) : note sur 100 = localisation (35) + comparables (20) + dispersion (30)
    // + ancienneté (15). Barèmes en paliers interpolés, bornés au premier et au dernier palier.
    // Rue : 30 points tant que ses ventes tiennent dans 150 m ; au-delà, les points du quartier pour
    // son étendue (demande de Pierre, 14/09/2026 : une rue de 531 m ne vaut pas mieux qu'un cercle).
    confiance: {
      localisation: {
        immeuble: 35,
        rue: { points: 30, jusquaMetres: 150 },
        quartier: [
          { jusquaMetres: 100, points: 26 },
          { jusquaMetres: 200, points: 22 },
          { jusquaMetres: 300, points: 18 },
          { jusquaMetres: null, points: 12 },
        ],
        commune: 4,
      },
      comparables: [
        { valeur: 3, points: 0 },
        { valeur: 10, points: 12 },
        { valeur: 30, points: 20 },
      ],
      dispersion: [
        { valeur: 0.1, points: 30 },
        { valeur: 0.45, points: 0 },
      ],
      anciennete: [
        { valeur: 6, points: 15 },
        { valeur: 30, points: 0 },
      ],
      ancienneteSupposeeMois: 12,
      niveaux: [
        { des: 80, niveau: 'elevee' },
        { des: 65, niveau: 'bonne' },
        { des: 45, niveau: 'moyenne' },
        { des: 25, niveau: 'faible' },
        { des: 0, niveau: 'tres_faible' },
      ],
    },
    marges: { elevee: 0.05, bonne: 0.065, moyenne: 0.08, faible: 0.12, tres_faible: 0.15 },
  },

  aConfirmer: [
    'fiscalite.prelevementsSociaux.bic',
    'acquisition.dmtoParDepartement',
    'estimation.dpe',
    'estimation.etage',
    'estimation.exterieur',
    'estimation.charges',
  ],
  simplifications: [
    'Estimation : l’état du bien le place entre le premier et le troisième quartile des ventes comparables',
    'Estimation : corrections additionnées ; coefficients d’étage des grandes villes de province appliqués partout',
    'Estimation : un balcon ou une terrasse ajoute une prime, son absence ne retire rien',
    'Amortissement du bâti en deux composants (55 % / 50 ans, 45 % / 20 ans)',
    'Frais d’acquisition passés en charge la première année au réel meublé',
    'Surtaxe sur les plus-values élevées appliquée par tranche, sans lissage',
    'Recettes BIC = loyers hors charges (charges refacturées ignorées)',
    'Intérêts capitalisés pendant un différé total non déduits fiscalement',
    'Rendement net et net-net calculés sur la première année pleine',
    'Scénario colocation : loyer total +35 % et 4 semaines de vacance, sans travaux d’aménagement',
  ],
};
