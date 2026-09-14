import type { Regles } from '../regles/types';

export interface ParametresEffort {
  readonly mensualiteTotale: number;
  /** `null` quand les revenus ne sont pas connus : aucun taux d'effort n'est calculé. */
  readonly revenusMensuels: number | null;
  readonly loyerMensuel: number;
  readonly dureeAnnees: number;
  readonly travaux: number;
  readonly prix: number;
}

export interface TauxEffort {
  /** Lecture HCSF : loyers comptés à 70 % dans les revenus. `null` sans revenu ni loyer. */
  readonly hcsf: number | null;
  /** Lecture prudente : sans les loyers. */
  readonly sansLoyers: number | null;
  readonly seuil: number;
  /** Vrai seulement quand l'effort est connu et dépasse le seuil : sans revenus, rien n'est signalé. */
  readonly depasseHcsf: boolean;
  readonly dureeMaxAnnees: number;
  readonly depasseDuree: boolean;
}

export function tauxEffort(params: ParametresEffort, regles: Regles): TauxEffort {
  const { hcsf: r } = regles.credit;
  const ratio = (denominateur: number): number | null =>
    denominateur > 0 ? params.mensualiteTotale / denominateur : null;
  const revenus = params.revenusMensuels;
  const hcsf = revenus === null ? null : ratio(revenus + r.partLoyers * params.loyerMensuel);
  const travauxLourds = params.travaux >= r.seuilTravauxPourDureeMax * params.prix;
  const dureeMaxAnnees = travauxLourds ? r.dureeMaxTravauxAnnees : r.dureeMaxAnnees;
  return {
    hcsf,
    sansLoyers: revenus === null ? null : ratio(revenus),
    seuil: r.seuilEffort,
    depasseHcsf: hcsf !== null && hcsf > r.seuilEffort,
    dureeMaxAnnees,
    depasseDuree: params.dureeAnnees > dureeMaxAnnees,
  };
}
