import type { Regles } from '../regles/types';

export interface ParametresEffort {
  readonly mensualiteTotale: number;
  readonly revenusMensuels: number;
  readonly loyerMensuel: number;
  readonly dureeAnnees: number;
  readonly travaux: number;
  readonly prix: number;
}

export interface TauxEffort {
  /** Lecture HCSF : loyers comptés à 70 % dans les revenus. `null` si aucun revenu. */
  readonly hcsf: number | null;
  /** Lecture prudente : sans les loyers. */
  readonly sansLoyers: number | null;
  readonly seuil: number;
  readonly depasseHcsf: boolean;
  readonly dureeMaxAnnees: number;
  readonly depasseDuree: boolean;
}

export function tauxEffort(params: ParametresEffort, regles: Regles): TauxEffort {
  const { hcsf: r } = regles.credit;
  const ratio = (denominateur: number): number | null =>
    denominateur > 0 ? params.mensualiteTotale / denominateur : null;
  const hcsf = ratio(params.revenusMensuels + r.partLoyers * params.loyerMensuel);
  const travauxLourds = params.travaux >= r.seuilTravauxPourDureeMax * params.prix;
  const dureeMaxAnnees = travauxLourds ? r.dureeMaxTravauxAnnees : r.dureeMaxAnnees;
  return {
    hcsf,
    sansLoyers: ratio(params.revenusMensuels),
    seuil: r.seuilEffort,
    depasseHcsf: hcsf === null || hcsf > r.seuilEffort,
    dureeMaxAnnees,
    depasseDuree: params.dureeAnnees > dureeMaxAnnees,
  };
}
