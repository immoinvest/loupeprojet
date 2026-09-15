import type { ProjetEntree } from '../schema/projet';

/**
 * Cas de référence « Projet 92K » : les entrées du modèle Excel de Pierre (feuilles « Calculs prêt
 * immo », « Calcul de l'autofinancement », « Imposition », « NEW - Revente »), relevées le 15/09/2026.
 * Lecture complète et formules : `.product/audit/excel-92k.md` ; écarts : `.product/audit/calculs-2026-09.md`.
 *
 * Colocation meublée de 4 chambres à 460 €, achetée 155 000 € FAI (9 000 € d'honoraires),
 * financée sur 25 ans à 3,30 % avec un apport égal aux frais de notaire de l'Excel (14 725 €).
 *
 * Ce que l'Excel ne dit pas ou que le moteur ne représente pas (voir l'audit) :
 * - département, surface, pièces : non précisés ; un département à 5 % de droits est retenu ;
 * - ligne « Autre » de 80 €/mois : pas de charge libre dans le moteur, elle est laissée de côté ;
 * - vacance : l'Excel compte 12 mois loués, le projet aussi (0 semaine) ;
 * - entretien : absent de l'Excel, mis à 0 ;
 * - revente : l'Excel part d'une « valeur avec travaux » de 160 000 € et paie 8 000 € d'agence ;
 *   le moteur part du prix retenu (155 000 €) et d'un taux d'agence (4,5 %).
 */
export const projet92k: ProjetEntree = {
  id: 'reference-projet-92k',
  versionRegles: '2026-09',
  bien: {
    type: 'appartement',
    surface: 80,
    pieces: 5,
    chambres: 4,
    departement: '13',
  },
  hypotheses: {
    achat: {
      prix: 155_000,
      honorairesAgence: 9_000,
      honorairesChargeAcquereur: true,
      travaux: 0,
      mobilier: 8_000,
    },
    pret: {
      apport: 14_725,
      tauxNominal: 0.033,
      dureeAnnees: 25,
      tauxAssurance: 0.0037,
      fraisDossier: 850,
      fraisGarantie: 2_000,
    },
    location: {
      mode: 'colocation',
      chambres: 4,
      loyerChambre: 460,
      forfaitChargesChambre: 0,
      vacanceSemaines: 0,
      gestionTaux: 0,
    },
    charges: {
      taxeFonciere: 960,
      coproAnnuel: 1_080,
      pno: 240,
      comptable: 360,
      cfe: 120,
      energieMensuel: 190,
      internetMensuel: 30,
      entretienTaux: 0,
    },
    fiscalite: {
      tmi: 0.3,
      regime: 'lmnp_reel',
    },
    revente: {
      annees: 5,
      evolutionAnnuelle: 0.02,
      fraisAgenceTaux: 0.045,
      diagnostics: 1_100,
    },
    revenusMensuels: 2_100,
  },
  provenance: {
    'achat.prix': 'excel-92k',
    'pret.tauxNominal': 'excel-92k',
    'location.loyerChambre': 'excel-92k',
  },
};
