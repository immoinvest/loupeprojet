import type { PeriodeAbattement, Regles } from '../regles/types';

export interface Abattements {
  /** Part de la plus-value exonérée d'impôt sur le revenu (0 à 1). */
  readonly ir: number;
  /** Part exonérée de prélèvements sociaux (0 à 1). */
  readonly ps: number;
}

function cumulAbattement(periodes: readonly PeriodeAbattement[], annees: number): number {
  const total = periodes.reduce((acc, p) => {
    const anneesDansPeriode = Math.max(0, Math.min(annees, p.aAnnee) - p.deAnnee + 1);
    return acc + anneesDansPeriode * p.tauxParAn;
  }, 0);
  return Math.min(1, total);
}

/** Abattements pour durée de détention (années pleines). */
export function abattementsDetention(annees: number, regles: Regles): Abattements {
  const { abattementIr, abattementPs } = regles.fiscalite.plusValue;
  return { ir: cumulAbattement(abattementIr, annees), ps: cumulAbattement(abattementPs, annees) };
}

/** Taux de surtaxe applicable à la plus-value nette imposable (par tranche, sans lissage). */
export function tauxSurtaxe(baseIr: number, regles: Regles): number {
  const { surtaxe, surtaxeSeuil } = regles.fiscalite.plusValue;
  if (baseIr <= surtaxeSeuil) return 0;
  const tranche = surtaxe.find((t) => t.jusqua === null || baseIr <= t.jusqua);
  return tranche === undefined ? 0 : tranche.taux;
}

export interface ParametresPlusValue {
  readonly valeur: number;
  readonly fraisVente: number;
  readonly prixAcquisition: number;
  readonly fraisAcquisitionReels: number;
  readonly travauxReels: number;
  readonly annees: number;
  /** Amortissements de l'immeuble déduits en LMNP réel, réintégrés depuis le 15/02/2025. */
  readonly amortissementsReintegres: number;
}

export interface DetailPlusValue {
  readonly prixCession: number;
  /** Prix stipulé dans l'acte, base des forfaits de 7,5 % et 15 % (BOI-RFPI-PVI-20-10-20-20 § 70). */
  readonly prixAcquisition: number;
  readonly fraisRetenus: number;
  readonly travauxRetenus: number;
  readonly reintegration: number;
  readonly prixAcquisitionMajore: number;
  readonly plusValueBrute: number;
  readonly abattements: Abattements;
  readonly baseIr: number;
  readonly basePs: number;
  readonly impotIr: number;
  readonly impotPs: number;
  readonly surtaxe: number;
  readonly impotTotal: number;
}

export function plusValueImposable(p: ParametresPlusValue, regles: Regles): DetailPlusValue {
  const { plusValue, prelevementsSociaux } = regles.fiscalite;
  const prixCession = p.valeur - p.fraisVente;
  const fraisRetenus = Math.max(
    p.fraisAcquisitionReels,
    p.prixAcquisition * plusValue.forfaitFrais,
  );
  const forfaitTravaux =
    p.annees >= plusValue.forfaitTravauxDesAnnee ? p.prixAcquisition * plusValue.forfaitTravaux : 0;
  const travauxRetenus = Math.max(p.travauxReels, forfaitTravaux);
  const prixAcquisitionMajore =
    p.prixAcquisition + fraisRetenus + travauxRetenus - p.amortissementsReintegres;
  const plusValueBrute = Math.max(0, prixCession - prixAcquisitionMajore);
  const abattements = abattementsDetention(p.annees, regles);
  const baseIr = plusValueBrute * (1 - abattements.ir);
  const basePs = plusValueBrute * (1 - abattements.ps);
  const impotIr = baseIr * plusValue.tauxIr;
  const impotPs = basePs * prelevementsSociaux.plusValue;
  const surtaxe = baseIr * tauxSurtaxe(baseIr, regles);
  return {
    prixCession,
    prixAcquisition: p.prixAcquisition,
    fraisRetenus,
    travauxRetenus,
    reintegration: p.amortissementsReintegres,
    prixAcquisitionMajore,
    plusValueBrute,
    abattements,
    baseIr,
    basePs,
    impotIr,
    impotPs,
    surtaxe,
    impotTotal: impotIr + impotPs + surtaxe,
  };
}
