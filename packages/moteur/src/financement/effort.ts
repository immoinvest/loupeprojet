import type { Regles } from '../regles/types';

export interface ParametresEffort {
  readonly mensualiteTotale: number;
  /** `null` quand le ménage n'a pas indiqué ses revenus. */
  readonly revenusMensuels: number | null;
  /** `null` quand le loyer n'est pas connu (rapport partiel). */
  readonly loyerMensuel: number | null;
  readonly dureeAnnees: number;
  readonly travaux: number;
  readonly prix: number;
}

export interface TauxEffort {
  /** Lecture HCSF : loyers comptés à 70 % dans les revenus. `null` sans revenus ou sans loyer. */
  readonly hcsf: number | null;
  /** Lecture prudente : sans les loyers. `null` sans revenus. */
  readonly sansLoyers: number | null;
  readonly seuil: number;
  /** Faux tant que l'effort est inconnu : un effort inconnu n'est pas un effort dépassé. */
  readonly depasseHcsf: boolean;
  readonly dureeMaxAnnees: number;
  readonly depasseDuree: boolean;
}

export function tauxEffort(params: ParametresEffort, regles: Regles): TauxEffort {
  const { hcsf: r } = regles.credit;
  const { revenusMensuels, loyerMensuel } = params;
  const ratio = (denominateur: number | null): number | null =>
    denominateur !== null && denominateur > 0 ? params.mensualiteTotale / denominateur : null;
  const hcsf =
    revenusMensuels === null || loyerMensuel === null
      ? null
      : ratio(revenusMensuels + r.partLoyers * loyerMensuel);
  const travauxLourds = params.travaux >= r.seuilTravauxPourDureeMax * params.prix;
  const dureeMaxAnnees = travauxLourds ? r.dureeMaxTravauxAnnees : r.dureeMaxAnnees;
  return {
    hcsf,
    sansLoyers: ratio(revenusMensuels),
    seuil: r.seuilEffort,
    depasseHcsf: hcsf !== null && hcsf > r.seuilEffort,
    dureeMaxAnnees,
    depasseDuree: params.dureeAnnees > dureeMaxAnnees,
  };
}
