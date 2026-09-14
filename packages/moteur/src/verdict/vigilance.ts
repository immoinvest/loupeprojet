import { estMeuble } from '../cashflow/charges';
import type { ResultatFinancement } from '../financement';
import type { ResultatFiscalite } from '../fiscalite/types';
import type { Projet } from '../schema/projet';

/**
 * Ce qui se règle avant l'offre et ne se vérifie pas en visite : banque, régime, loyer encadré.
 * Ce qui se vérifie sur place ou se demande au vendeur vit dans la base de questions de visite.
 */
export type CodeVigilance =
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

/** Les points de la banque : présents même sans loyer (un effort inconnu n'est pas dépassé). */
function pointsFinancement(financement: ResultatFinancement): PointVigilance[] {
  const points: PointVigilance[] = [];
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

/**
 * Points financiers à régler avant de faire une offre, par règles. Sans fiscalité (loyer absent),
 * seulement ceux de la banque.
 */
export function pointsDeVigilance(
  projet: Projet,
  financement: ResultatFinancement,
  fiscalite: ResultatFiscalite | null,
): PointVigilance[] {
  return [
    ...pointsFinancement(financement),
    ...(fiscalite === null ? [] : pointsFiscaux(projet, fiscalite)),
  ];
}
