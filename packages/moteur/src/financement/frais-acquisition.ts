import { prixRetenu } from '../achat';
import type { Regles } from '../regles/types';
import type { Hypotheses } from '../schema/hypotheses';

export interface DetailFraisAcquisition {
  /** Assiette des droits et émoluments : prix hors honoraires d'agence à la charge de l'acquéreur. */
  readonly base: number;
  readonly tauxDmto: number;
  /** Droits de mutation : départemental + frais d'assiette + taxe communale. */
  readonly droits: number;
  readonly emolumentsHt: number;
  readonly emolumentsTtc: number;
  readonly contributionSecuriteImmobiliere: number;
  readonly debours: number;
  readonly total: number;
}

type Achat = Hypotheses['achat'];

/** Assiette : le prix retenu (négocié), moins les honoraires payés par l'acquéreur, qui ne supportent ni droits ni émoluments. */
export function baseFraisAcquisition(achat: Achat): number {
  const prix = prixRetenu(achat);
  return achat.honorairesChargeAcquereur ? prix - achat.honorairesAgence : prix;
}

export function tauxDmto(achat: Achat, departement: string, regles: Regles): number {
  return (
    achat.dmtoTaux ??
    regles.acquisition.dmtoParDepartement[departement] ??
    regles.acquisition.dmtoDefaut
  );
}

/** Émoluments proportionnels du notaire, par tranches cumulatives (HT). */
export function emolumentsNotaireHt(base: number, regles: Regles): number {
  let total = 0;
  let plancher = 0;
  for (const tranche of regles.acquisition.emoluments) {
    const plafond = tranche.jusqua ?? Number.POSITIVE_INFINITY;
    const assiette = Math.max(0, Math.min(base, plafond) - plancher);
    total += assiette * tranche.taux;
    plancher = plafond;
  }
  return total;
}

export function fraisAcquisition(
  achat: Achat,
  departement: string,
  regles: Regles,
): DetailFraisAcquisition {
  const { acquisition } = regles;
  const base = baseFraisAcquisition(achat);
  const dmto = tauxDmto(achat, departement, regles);
  const droits = base * (dmto * (1 + acquisition.fraisAssiette) + acquisition.taxeCommunale);
  const emolumentsHt = emolumentsNotaireHt(base, regles);
  const emolumentsTtc = emolumentsHt * (1 + acquisition.tva);
  const contributionSecuriteImmobiliere = base * acquisition.contributionSecuriteImmobiliere;
  const debours = base * acquisition.debours;
  return {
    base,
    tauxDmto: dmto,
    droits,
    emolumentsHt,
    emolumentsTtc,
    contributionSecuriteImmobiliere,
    debours,
    total: droits + emolumentsTtc + contributionSecuriteImmobiliere + debours,
  };
}
