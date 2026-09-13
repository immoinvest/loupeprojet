import { ErreurHypotheseInvalide } from '../commun/erreurs';
import { assuranceMensuelle, calculerMensualite } from './mensualite';

export type PhaseCredit = 'differe_total' | 'differe_partiel' | 'amortissement';

export interface ParametresPret {
  readonly capital: number;
  readonly tauxAnnuel: number;
  readonly dureeMois: number;
  readonly differeTotalMois: number;
  readonly differePartielMois: number;
  readonly tauxAssurance: number;
}

export interface LigneAmortissement {
  readonly mois: number;
  readonly annee: number;
  readonly phase: PhaseCredit;
  readonly crdDebut: number;
  readonly interets: number;
  readonly capital: number;
  readonly mensualite: number;
  readonly assurance: number;
  readonly crdFin: number;
}

export interface AnneeCredit {
  readonly annee: number;
  readonly interets: number;
  readonly capital: number;
  readonly mensualites: number;
  readonly assurance: number;
  readonly crdFin: number;
}

function phaseDuMois(mois: number, p: ParametresPret): PhaseCredit {
  if (mois <= p.differeTotalMois) return 'differe_total';
  if (mois <= p.differeTotalMois + p.differePartielMois) return 'differe_partiel';
  return 'amortissement';
}

/**
 * Mensualité de la phase d'amortissement : le capital a grossi des intérêts
 * capitalisés pendant le différé total, et la durée restante est plus courte.
 */
export function mensualiteAmortissement(p: ParametresPret): number {
  const tauxMensuel = p.tauxAnnuel / 12;
  const moisAmortissement = p.dureeMois - p.differeTotalMois - p.differePartielMois;
  const capitalApresDiffere = p.capital * (1 + tauxMensuel) ** p.differeTotalMois;
  return calculerMensualite(capitalApresDiffere, p.tauxAnnuel, moisAmortissement);
}

function ligne(
  mois: number,
  crdDebut: number,
  phase: PhaseCredit,
  mensualiteNormale: number,
  assurance: number,
  tauxMensuel: number,
): LigneAmortissement {
  const interets = crdDebut * tauxMensuel;
  const commun = { mois, annee: Math.ceil(mois / 12), phase, crdDebut, interets, assurance };
  switch (phase) {
    case 'differe_total':
      return { ...commun, capital: 0, mensualite: 0, crdFin: crdDebut + interets };
    case 'differe_partiel':
      return { ...commun, capital: 0, mensualite: interets, crdFin: crdDebut };
    case 'amortissement': {
      const capital = mensualiteNormale - interets;
      return { ...commun, capital, mensualite: mensualiteNormale, crdFin: crdDebut - capital };
    }
  }
}

/** Tableau mensuel complet. Capital nul (apport couvrant tout) → tableau vide. */
export function tableauAmortissement(p: ParametresPret): LigneAmortissement[] {
  if (p.differeTotalMois + p.differePartielMois >= p.dureeMois) {
    throw new ErreurHypotheseInvalide('Le différé doit être plus court que le prêt');
  }
  if (p.capital <= 0) return [];
  const tauxMensuel = p.tauxAnnuel / 12;
  const mensualiteNormale = mensualiteAmortissement(p);
  const assurance = assuranceMensuelle(p.capital, p.tauxAssurance);
  const lignes: LigneAmortissement[] = [];
  let crd = p.capital;
  for (let mois = 1; mois <= p.dureeMois; mois += 1) {
    const l = ligne(mois, crd, phaseDuMois(mois, p), mensualiteNormale, assurance, tauxMensuel);
    lignes.push(l);
    crd = l.crdFin;
  }
  return lignes;
}

export function regrouperParAnnee(lignes: readonly LigneAmortissement[]): AnneeCredit[] {
  const annees = new Map<number, AnneeCredit>();
  for (const l of lignes) {
    const c = annees.get(l.annee) ?? {
      annee: l.annee,
      interets: 0,
      capital: 0,
      mensualites: 0,
      assurance: 0,
      crdFin: 0,
    };
    annees.set(l.annee, {
      annee: l.annee,
      interets: c.interets + l.interets,
      capital: c.capital + l.capital,
      mensualites: c.mensualites + l.mensualite,
      assurance: c.assurance + l.assurance,
      crdFin: l.crdFin,
    });
  }
  return [...annees.values()];
}

/** Capital restant dû à la fin d'une année ; 0 au-delà du prêt. */
export function crdFinAnnee(parAnnee: readonly AnneeCredit[], annee: number): number {
  return parAnnee.find((a) => a.annee === annee)?.crdFin ?? 0;
}
