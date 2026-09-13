import type { ProjetEntree } from '../schema/projet';

/**
 * Projet d'exemple : T3 de 65 m² à Marseille 5e, 155 000 € FAI.
 * Chiffres inventés mais crédibles (marché marseillais 2026), utilisés par les tests
 * et par le premier écran de l'app pour montrer un rapport complet.
 */
export const projetExemple: ProjetEntree = {
  id: 'exemple-t3-marseille',
  versionRegles: '2026-09',
  bien: {
    type: 'appartement',
    surface: 65,
    pieces: 3,
    chambres: 2,
    etage: 3,
    ascenseur: false,
    annee: 1962,
    dpe: 'D',
    ges: 'B',
    departement: '13',
    copro: { lots: 24, procedure: false },
  },
  marche: {
    dvf: { medianM2: 3050, q1M2: 2700, q3M2: 3400, nombreVentes: 31, rayonMetres: 500 },
    loyerReferenceM2: 15.1,
    risques: [{ type: 'argiles', niveau: 'moyen' }],
  },
  hypotheses: {
    achat: {
      prix: 155_000,
      honorairesAgence: 7_000,
      honorairesChargeAcquereur: true,
      travaux: 6_000,
      mobilier: 5_000,
    },
    pret: {
      apport: 14_337,
      tauxNominal: 0.0335,
      dureeAnnees: 25,
      tauxAssurance: 0.0025,
      fraisDossier: 850,
      fraisGarantie: 1_500,
    },
    location: {
      mode: 'meuble_lld',
      loyerHc: 980,
      loyerHcNu: 850,
      chargesLocataire: 60,
      vacanceSemaines: 3,
    },
    charges: {
      taxeFonciere: 1_050,
      coproAnnuel: 1_080,
      pno: 180,
      comptable: 420,
      cfe: 180,
      entretienTaux: 0.005,
    },
    fiscalite: {
      tmi: 0.3,
      regime: 'lmnp_reel',
    },
    revente: {
      annees: 10,
      evolutionAnnuelle: 0.015,
      fraisAgenceTaux: 0.04,
    },
    revenusMensuels: 2_600,
  },
  provenance: {
    'achat.prix': 'annonce',
    'achat.honorairesAgence': 'annonce',
    'bien.surface': 'annonce',
    'bien.dpe': 'ademe',
    'charges.taxeFonciere': 'annonce',
    'charges.coproAnnuel': 'annonce',
    'location.loyerHc': 'utilisateur',
    'pret.tauxNominal': 'usure',
    'pret.apport': 'utilisateur',
  },
};
