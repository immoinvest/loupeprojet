import { estMeuble } from '../cashflow/charges';
import type { ResultatFinancement } from '../financement';
import type { ResultatFiscalite } from '../fiscalite/types';
import { loyerMensuelHc } from '../location/equivalents';
import type { Regles } from '../regles/types';
import { ClasseEnergieSchema } from '../schema/bien';
import type { Projet } from '../schema/projet';
import type { FeuVerdict } from './feux';

export type CodeVigilance =
  | 'PV_AG_ET_CARNET'
  | 'CONFIRMER_CHARGES_COPRO'
  | 'COPRO_EN_PROCEDURE'
  | 'VERIFIER_DPE'
  | 'RENOVATION_ENERGETIQUE_OBLIGATOIRE'
  | 'EXPLIQUER_PRIX_SOUS_MARCHE'
  | 'CONFIRMER_TAXE_FONCIERE'
  | 'RISQUE_NATUREL'
  | 'SANS_ASCENSEUR_ETAGE_ELEVE'
  | 'EFFORT_HCSF_DEPASSE'
  | 'DUREE_PRET_HORS_HCSF'
  | 'PLAFOND_MICRO_DEPASSE'
  | 'LOYER_AU_DESSUS_PLAFOND'
  | 'PS_BIC_A_CONFIRMER'
  | 'CHANGEMENT_USAGE_COURTE_DUREE'
  | 'DPE_MEUBLE_TOURISME'
  | 'REGLEMENT_COPRO_LOCATION'
  | 'SURFACE_CHAMBRES_COLOCATION'
  | 'BAIL_MOBILITE_CONDITIONS';

/** Un code et ses paramètres ; la phrase est écrite côté interface, jamais ici. */
export interface PointVigilance {
  readonly code: CodeVigilance;
  readonly parametres: Readonly<Record<string, number | string>>;
}

const ETAGE_SANS_ASCENSEUR = 3;
const CLASSES = ClasseEnergieSchema.options;

function pointsBien(projet: Projet, regles: Regles): PointVigilance[] {
  const { bien } = projet;
  const points: PointVigilance[] = [];
  if (bien.copro !== undefined) {
    points.push({
      code: 'PV_AG_ET_CARNET',
      parametres: { lots: bien.copro.lots ?? 0, annee: bien.annee ?? 0 },
    });
    points.push({ code: 'CONFIRMER_CHARGES_COPRO', parametres: {} });
    if (bien.copro.procedure) points.push({ code: 'COPRO_EN_PROCEDURE', parametres: {} });
  }
  if (bien.dpe !== undefined) {
    points.push({ code: 'VERIFIER_DPE', parametres: { dpe: bien.dpe } });
    const interdiction = regles.exploitation.interdictionLocationDpe;
    if (bien.dpe === 'E' || bien.dpe === 'F' || bien.dpe === 'G') {
      points.push({
        code: 'RENOVATION_ENERGETIQUE_OBLIGATOIRE',
        parametres: { dpe: bien.dpe, annee: interdiction[bien.dpe] },
      });
    }
  }
  if (bien.etage !== undefined && bien.etage >= ETAGE_SANS_ASCENSEUR && bien.ascenseur === false) {
    points.push({ code: 'SANS_ASCENSEUR_ETAGE_ELEVE', parametres: { etage: bien.etage } });
  }
  for (const risque of projet.marche.risques.filter((r) => r.niveau === 'fort')) {
    points.push({ code: 'RISQUE_NATUREL', parametres: { type: risque.type } });
  }
  return points;
}

/** Points propres au type d'exploitation : réglementation des meublés de tourisme, décence en colocation, bail mobilité. */
function pointsLocation(projet: Projet, regles: Regles): PointVigilance[] {
  const { bien } = projet;
  const { location } = projet.hypotheses;
  const { meubleTourisme, colocation, bailMobilite } = regles.exploitation;
  const points: PointVigilance[] = [];
  if (location.mode === 'courte_duree') {
    points.push({
      code: 'CHANGEMENT_USAGE_COURTE_DUREE',
      parametres: {
        zone: meubleTourisme.departementsChangementUsage.includes(bien.departement)
          ? 'plein_droit'
          : 'a_verifier',
        joursResidencePrincipale: meubleTourisme.joursMaxResidencePrincipale,
      },
    });
    if (
      bien.dpe !== undefined &&
      CLASSES.indexOf(bien.dpe) > CLASSES.indexOf(meubleTourisme.dpeMinTous)
    ) {
      points.push({
        code: 'DPE_MEUBLE_TOURISME',
        parametres: {
          dpe: bien.dpe,
          classeMinimale: meubleTourisme.dpeMinNouvelleAutorisation,
          classeTous: meubleTourisme.dpeMinTous,
          annee: meubleTourisme.dpeMinTousDes,
        },
      });
    }
  }
  if (location.mode === 'colocation') {
    points.push({
      code: 'SURFACE_CHAMBRES_COLOCATION',
      parametres: {
        chambres: location.chambres,
        surfaceParChambre: Math.round(bien.surface / location.chambres),
        surfaceMinimale: colocation.surfaceMinChambreM2,
        volumeMinimal: colocation.volumeMinChambreM3,
      },
    });
  }
  if (
    (location.mode === 'courte_duree' || location.mode === 'colocation') &&
    bien.copro !== undefined
  ) {
    points.push({ code: 'REGLEMENT_COPRO_LOCATION', parametres: { mode: location.mode } });
  }
  if (location.mode === 'moyenne_duree') {
    points.push({
      code: 'BAIL_MOBILITE_CONDITIONS',
      parametres: { dureeMin: bailMobilite.dureeMinMois, dureeMax: bailMobilite.dureeMaxMois },
    });
  }
  return points;
}

function pointsFinanciers(
  projet: Projet,
  financement: ResultatFinancement,
  fiscalite: ResultatFiscalite,
  feuPrix: FeuVerdict,
): PointVigilance[] {
  const points: PointVigilance[] = [];
  if (feuPrix.feu === 'bon' && feuPrix.valeur !== null) {
    points.push({ code: 'EXPLIQUER_PRIX_SOUS_MARCHE', parametres: { ecart: feuPrix.valeur } });
  }
  points.push({ code: 'CONFIRMER_TAXE_FONCIERE', parametres: {} });
  if (financement.effort.depasseHcsf) {
    points.push({ code: 'EFFORT_HCSF_DEPASSE', parametres: { seuil: financement.effort.seuil } });
  }
  if (financement.effort.depasseDuree) {
    points.push({
      code: 'DUREE_PRET_HORS_HCSF',
      parametres: { dureeMax: financement.effort.dureeMaxAnnees },
    });
  }
  const retenu = fiscalite.regimes[fiscalite.retenu];
  if (!retenu.eligible) {
    points.push({ code: 'PLAFOND_MICRO_DEPASSE', parametres: { regime: fiscalite.retenu } });
  }
  const { plafondLoyerMensuel } = projet.marche;
  const { location } = projet.hypotheses;
  if (
    plafondLoyerMensuel !== undefined &&
    location.mode !== 'courte_duree' &&
    loyerMensuelHc(location) > plafondLoyerMensuel
  ) {
    points.push({ code: 'LOYER_AU_DESSUS_PLAFOND', parametres: { plafond: plafondLoyerMensuel } });
  }
  if (estMeuble(fiscalite.retenu)) {
    points.push({
      code: 'PS_BIC_A_CONFIRMER',
      parametres: { taux: projet.hypotheses.fiscalite.psBic },
    });
  }
  return points;
}

/** Points à vérifier en visite ou avant d'acheter, par règles. */
export function pointsDeVigilance(
  projet: Projet,
  financement: ResultatFinancement,
  fiscalite: ResultatFiscalite,
  feuPrix: FeuVerdict,
  regles: Regles,
): PointVigilance[] {
  return [
    ...pointsBien(projet, regles),
    ...pointsLocation(projet, regles),
    ...pointsFinanciers(projet, financement, fiscalite, feuPrix),
  ];
}
