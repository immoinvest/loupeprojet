import type { PointVigilance } from '@loupe/moteur';

import { euros, pourcentage, pourcentageSigne } from '@/formatage/nombres';

function param(point: PointVigilance, cle: string): number | string {
  return point.parametres[cle] ?? '';
}

function nombreParam(point: PointVigilance, cle: string): number {
  const v = param(point, cle);
  return typeof v === 'number' ? v : 0;
}

/** Phrase à afficher pour un code de vigilance rendu par le moteur. */
export function phraseVigilance(point: PointVigilance): string {
  switch (point.code) {
    case 'PV_AG_ET_CARNET': {
      const lots = nombreParam(point, 'lots');
      const annee = nombreParam(point, 'annee');
      const detail = [lots > 0 ? `${String(lots)} lots` : '', annee > 0 ? String(annee) : '']
        .filter((s) => s !== '')
        .join(', ');
      return `Demander les trois derniers PV d'AG et le carnet d'entretien${detail === '' ? '' : ` (${detail})`}.`;
    }
    case 'CONFIRMER_CHARGES_COPRO':
      return 'Confirmer les charges de copropriété sur les derniers appels de fonds.';
    case 'COPRO_EN_PROCEDURE':
      return 'La copropriété est en procédure : lire le PV et le budget avant toute offre.';
    case 'VERIFIER_DPE':
      return `Vérifier le DPE ${String(param(point, 'dpe'))} et le mode de chauffage.`;
    case 'RENOVATION_ENERGETIQUE_OBLIGATOIRE':
      return `DPE ${String(param(point, 'dpe'))} : location interdite à partir de ${String(param(point, 'annee'))} sans rénovation énergétique.`;
    case 'EXPLIQUER_PRIX_SOUS_MARCHE':
      return `Demander pourquoi le prix est ${pourcentageSigne(Math.abs(nombreParam(point, 'ecart')) * -1)} sous le marché.`;
    case 'CONFIRMER_TAXE_FONCIERE':
      return "Demander l'avis de taxe foncière au vendeur.";
    case 'RISQUE_NATUREL':
      return `Zone à risque ${String(param(point, 'type'))} : consulter l'état des risques.`;
    case 'SANS_ASCENSEUR_ETAGE_ELEVE':
      return `${String(param(point, 'etage'))}e étage sans ascenseur : vérifier la cage d'escalier et penser à la relocation.`;
    case 'EFFORT_HCSF_DEPASSE':
      return `Taux d'effort au-dessus du seuil bancaire de ${pourcentage(nombreParam(point, 'seuil'), 0)} : financement difficile.`;
    case 'DUREE_PRET_HORS_HCSF':
      return `Prêt plus long que le maximum bancaire de ${String(param(point, 'dureeMax'))} ans.`;
    case 'PLAFOND_MICRO_DEPASSE':
      return 'Les recettes dépassent le plafond du régime micro choisi : passer au réel.';
    case 'LOYER_AU_DESSUS_PLAFOND':
      return `Loyer au-dessus du plafond d'encadrement (${euros(nombreParam(point, 'plafond'))}).`;
    case 'PS_BIC_A_CONFIRMER':
      return `Prélèvements sociaux du meublé à ${pourcentage(nombreParam(point, 'taux'))} : taux à confirmer.`;
  }
}
