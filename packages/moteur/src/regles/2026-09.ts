import type { Regles } from './types';

/**
 * Règles connues au 14 septembre 2026.
 * Sources : .product/functional-spec.md (section « Moteur de calcul ») et ses liens ;
 * .product/features/location-types-discovery.md (§ 5) pour les types d'exploitation.
 * Toute valeur marquée dans `aConfirmer` attend une source officielle consolidée.
 */
export const regles202609: Regles = {
  version: '2026-09',
  dateReference: '2026-09-14',

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
    // Spec Deklic : +15 à +25 % de loyer en meublé selon les villes.
    primeMeuble: 0.15,
    // Spec Deklic : +30 à +45 % de loyer total en colocation.
    primeColocation: 0.35,
    interdictionLocationDpe: { G: 2025, F: 2028, E: 2034 },
    parType: {
      // Spec Deklic : 2 à 3 semaines de vacance en location nue ; auto-gestion par défaut.
      nu: { vacanceSemaines: 3, gestionTaux: 0 },
      // Spec Deklic : 3 semaines en meublé longue durée (8 à 10 en étudiant : à saisir).
      meuble: { vacanceSemaines: 3, gestionTaux: 0 },
      // Spec Deklic : un mois de vacance par chambre. Énergie et internet : Excel « Projet 92K »
      // de Pierre (feuille « Calcul de l'autofinancement », lue le 14/09/2026), à confirmer.
      colocation: { vacanceSemaines: 4, gestionTaux: 0, energieMensuel: 190, internetMensuel: 30 },
      // Excel « Projet 92K » : scénario médian 15 nuits et 4 séjours par mois, ménage 27 € par séjour ;
      // plateforme : Airbnb, centre d'aide art. 1857 (lu le 14/09/2026), frais partagés 3 % pour
      // l'hôte (15,5 % en frais uniques) ; conciergerie 0 = auto-gestion ; nuitée de départ = deux
      // loyers journaliers (choix Deklic, repris de l'ancien formulaire). Tout à confirmer.
      courte_duree: {
        nuiteesParMois: 15,
        dureeSejourNuits: 4,
        menageParSejour: 27,
        plateformeTaux: 0.03,
        conciergerieTaux: 0,
        nuiteeEnLoyersJournaliers: 2,
        energieMensuel: 190,
        internetMensuel: 30,
      },
      // Choix Deklic sans source publique : 4 semaines vides par an, séjours de 4 mois (milieu de
      // 1 à 10), ménage et plateforme à saisir. Énergie et internet : Excel « Projet 92K ». À confirmer.
      moyenne_duree: {
        vacanceSemaines: 4,
        dureeSejourMois: 4,
        menageParSejour: 0,
        plateformeTaux: 0,
        gestionTaux: 0,
        energieMensuel: 190,
        internetMensuel: 30,
      },
    },
    // Loi n° 89-462 art. 8-1 (ALUR, ELAN) et décret n° 2002-120 : colocation à baux individuels.
    colocation: { surfaceMinChambreM2: 9, volumeMinChambreM3: 20 },
    // Loi n° 2024-1039 du 19/11/2024 (Le Meur) ; CCH art. L. 631-7 (Paris et petite couronne de plein
    // droit, communes de plus de 200 000 habitants ; toute commune peut l'instaurer par délibération).
    meubleTourisme: {
      dpeMinNouvelleAutorisation: 'E',
      dpeMinTous: 'D',
      dpeMinTousDes: 2034,
      joursMaxResidencePrincipale: 120,
      departementsChangementUsage: ['75', '92', '93', '94'],
    },
    // Loi n° 89-462 art. 25-12 (loi ELAN du 23/11/2018).
    bailMobilite: { dureeMinMois: 1, dureeMaxMois: 10 },
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
      // Loi n° 2024-1039 du 19/11/2024 (Le Meur), CGI art. 50-0 : meublé de tourisme non classé.
      abattementTourismeNonClasse: 0.3,
      // Seuil 2026-2028 (meublé classique et meublé de tourisme classé).
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
    // Choix Deklic : confiance élevée avec 10 ventes à 300 m, moyenne avec 5 ventes à 1 km.
    confiance: {
      eleveeVentes: 10,
      eleveeRayonMetres: 300,
      moyenneVentes: 5,
      moyenneRayonMetres: 1_000,
    },
    marges: { elevee: 0.05, moyenne: 0.08, faible: 0.12 },
  },

  aConfirmer: [
    'fiscalite.prelevementsSociaux.bic',
    'acquisition.dmtoParDepartement',
    'estimation.dpe',
    'estimation.etage',
    'estimation.exterieur',
    'estimation.charges',
    'exploitation.parType.colocation.energieMensuel',
    'exploitation.parType.colocation.internetMensuel',
    'exploitation.parType.courte_duree.nuiteesParMois',
    'exploitation.parType.courte_duree.dureeSejourNuits',
    'exploitation.parType.courte_duree.menageParSejour',
    'exploitation.parType.courte_duree.plateformeTaux',
    'exploitation.parType.courte_duree.nuiteeEnLoyersJournaliers',
    'exploitation.parType.courte_duree.energieMensuel',
    'exploitation.parType.courte_duree.internetMensuel',
    'exploitation.parType.moyenne_duree.vacanceSemaines',
    'exploitation.parType.moyenne_duree.dureeSejourMois',
    'exploitation.parType.moyenne_duree.energieMensuel',
    'exploitation.parType.moyenne_duree.internetMensuel',
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
    'Scénario colocation : loyer total +35 % et 4 semaines de vacance par chambre, sans travaux d’aménagement',
    'Forfaits de charges et ménage facturé comptés dans les recettes imposables ; frais de plateforme, conciergerie et ménage payé déductibles au réel seulement',
    'Courte durée : nuitées réparties uniformément sur l’année, sans saisonnalité',
    'Colocation : vacance appliquée de la même façon à toutes les chambres',
  ],
};
