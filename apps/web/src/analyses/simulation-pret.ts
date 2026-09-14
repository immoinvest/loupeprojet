import { arrondirCentime, type Resultats, type SimulationPretEntree } from '@loupe/moteur';

import { CHEMIN_SIMULATEUR, fragmentSimulation } from '@/simulateur';

/**
 * Le lien « Simuler un prêt » : le prêt d'un projet, dans le format du simulateur de prêt
 * (`/simulateur-pret#s=…`, `SimulationPretSchema` du moteur). Ouvert, le simulateur retrouve
 * au centime la mensualité du rapport : frais bancaires financés, comme dans un projet.
 */

/** Le prêt du projet tel que le rapport le calcule, prêt à être repris par le simulateur. */
export function simulationDepuisResultats(r: Resultats): SimulationPretEntree {
  const { achat, pret } = r.projet.hypotheses;
  const honoraires = achat.honorairesChargeAcquereur ? achat.honorairesAgence : 0;
  return {
    versionRegles: r.meta.versionRegles,
    projet: {
      prix: achat.prix,
      ...(honoraires > 0 ? { honorairesAgence: honoraires } : {}),
      ...(achat.travaux > 0 ? { travaux: achat.travaux } : {}),
      // Frontière d'affichage : le lien porte des centimes, pas le bruit du calcul en flottant.
      fraisNotaire: arrondirCentime(r.financement.fraisAcquisition.total),
      departement: r.projet.bien.departement,
    },
    offres: [
      {
        apport: pret.apport,
        fraisDossier: pret.fraisDossier,
        fraisGarantie: pret.fraisGarantie,
        fraisBancairesFinances: true,
        tauxNominal: pret.tauxNominal,
        tauxAssurance: pret.tauxAssurance,
        dureeAnnees: pret.dureeAnnees,
        ...(pret.differeTotalMois > 0 ? { differeTotalMois: pret.differeTotalMois } : {}),
        ...(pret.differePartielMois > 0 ? { differePartielMois: pret.differePartielMois } : {}),
      },
    ],
  };
}

/** Le chemin du simulateur avec le prêt dans le fragment : `/simulateur-pret#s=…`. */
export function lienSimulateurPret(simulation: SimulationPretEntree): string {
  return `${CHEMIN_SIMULATEUR}${fragmentSimulation(simulation)}`;
}
