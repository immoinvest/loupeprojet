import { estMeuble } from '../cashflow/charges';
import type { ResultatFinancement } from '../financement';
import type { ResultatFiscalite } from '../fiscalite/types';
import { loyerMensuelHc } from '../location/equivalents';
import type { Projet } from '../schema/projet';

/**
 * Ce qui se règle avant l'offre et ne se vérifie pas en visite : banque, régime, loyer encadré.
 * Ce qui se vérifie sur place ou se demande au vendeur vit dans la base de questions de visite,
 * y compris les obligations propres au type de location (changement d'usage, décence des chambres…).
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

/** Points financiers à régler avant de faire une offre, par règles. */
export function pointsDeVigilance(
  projet: Projet,
  financement: ResultatFinancement,
  fiscalite: ResultatFiscalite,
): PointVigilance[] {
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
  const retenu = fiscalite.regimes[fiscalite.retenu];
  if (!retenu.eligible) {
    points.push({ code: 'PLAFOND_MICRO_DEPASSE', parametres: { regime: fiscalite.retenu } });
  }
  // Encadrement : le loyer mensuel équivalent (total des chambres en colocation) ; jamais une nuitée.
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
