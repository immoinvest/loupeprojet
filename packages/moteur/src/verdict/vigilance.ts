import { estMeuble } from '../cashflow/charges';
import type { ResultatFinancement } from '../financement';
import type { ResultatFiscalite } from '../fiscalite/types';
import type { Regles } from '../regles/types';
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
  | 'PS_BIC_A_CONFIRMER';

/** Un code et ses paramètres ; la phrase est écrite côté interface, jamais ici. */
export interface PointVigilance {
  readonly code: CodeVigilance;
  readonly parametres: Readonly<Record<string, number | string>>;
}

const ETAGE_SANS_ASCENSEUR = 3;

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

/** Les points qui ne demandent que le financement et le prix : présents même sans loyer. */
function pointsFinancement(
  financement: ResultatFinancement,
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
  return points;
}

/** Les points qui demandent le loyer et la fiscalité : absents d'un rapport partiel. */
function pointsFiscaux(projet: Projet, fiscalite: ResultatFiscalite): PointVigilance[] {
  const points: PointVigilance[] = [];
  const retenu = fiscalite.regimes[fiscalite.retenu];
  if (!retenu.eligible) {
    points.push({ code: 'PLAFOND_MICRO_DEPASSE', parametres: { regime: fiscalite.retenu } });
  }
  const { plafondLoyerMensuel } = projet.marche;
  const { loyerHc } = projet.hypotheses.location;
  if (plafondLoyerMensuel !== undefined && loyerHc !== undefined && loyerHc > plafondLoyerMensuel) {
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
  fiscalite: ResultatFiscalite | null,
  feuPrix: FeuVerdict,
  regles: Regles,
): PointVigilance[] {
  return [
    ...pointsBien(projet, regles),
    ...pointsFinancement(financement, feuPrix),
    ...(fiscalite === null ? [] : pointsFiscaux(projet, fiscalite)),
  ];
}
