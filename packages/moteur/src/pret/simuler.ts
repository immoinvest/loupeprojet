import { sommer } from '../commun/flux';
import {
  regrouperParAnnee,
  tableauAmortissement,
  type AnneeCredit,
  type LigneAmortissement,
} from '../financement/amortissement';
import { echeancier, type Echeance } from '../financement/index';
import { assuranceMensuelle } from '../financement/mensualite';
import { taeg } from '../financement/taeg';
import type { Regles } from '../regles/types';
import type { OffrePret, ProjetFinance } from './schema';

export interface ResultatPret {
  /** `false` quand l'apport couvre tout : tableau vide, mensualités nulles, TAEG absent. */
  readonly aEmprunter: boolean;
  /** Prix + travaux + frais de notaire, plus les frais bancaires s'ils sont financés. */
  readonly besoin: number;
  readonly montantEmprunte: number;
  /** Frais de dossier + garantie, financés ou payés comptant. */
  readonly fraisBancaires: number;
  /** Mensualités de la phase d'amortissement. */
  readonly mensualiteHorsAssurance: number;
  readonly assuranceMensuelle: number;
  readonly mensualiteTotale: number;
  readonly echeancier: readonly Echeance[];
  readonly tableau: readonly LigneAmortissement[];
  readonly parAnnee: readonly AnneeCredit[];
  readonly totalInterets: number;
  readonly totalAssurance: number;
  /** Somme de toutes les échéances, assurance comprise. */
  readonly totalMensualites: number;
  /** Intérêts + assurance + frais bancaires. */
  readonly coutTotalCredit: number;
  readonly taegHorsAssurance: number | null;
  readonly taegAvecAssurance: number | null;
  readonly tauxUsure: number;
  readonly tauxUsureDepasse: boolean;
  /** Mensualité totale ÷ revenus nets ; `null` sans revenus. Distinct de l'effort HCSF d'un projet. */
  readonly endettement: number | null;
}

export function fraisBancaires(offre: OffrePret): number {
  return offre.fraisDossier + offre.fraisGarantie;
}

/** Ce qu'il faut financer avant apport. */
export function besoinFinancement(projet: ProjetFinance, offre: OffrePret): number {
  const frais = offre.fraisBancairesFinances ? fraisBancaires(offre) : 0;
  return projet.prix + projet.travaux + projet.fraisNotaire + frais;
}

function tauxEndettement(mensualiteTotale: number, revenus: number | undefined): number | null {
  if (revenus === undefined || revenus <= 0) return null;
  return mensualiteTotale / revenus;
}

/**
 * Tous les chiffres d'une offre, avec les formules du rapport d'un projet : même tableau
 * d'amortissement, TAEG résolu numériquement. Les frais bancaires comptent dans le TAEG
 * qu'ils soient financés ou payés comptant : ils réduisent le capital réellement disponible.
 */
export function simulerPret(projet: ProjetFinance, offre: OffrePret, regles: Regles): ResultatPret {
  const frais = fraisBancaires(offre);
  const besoin = besoinFinancement(projet, offre);
  const montantEmprunte = Math.max(0, besoin - offre.apport);
  const tableau = tableauAmortissement({
    capital: montantEmprunte,
    tauxAnnuel: offre.tauxNominal,
    dureeMois: offre.dureeAnnees * 12,
    differeTotalMois: offre.differeTotalMois,
    differePartielMois: offre.differePartielMois,
    tauxAssurance: offre.tauxAssurance,
  });
  const mensualiteHorsAssurance = tableau.find((l) => l.phase === 'amortissement')?.mensualite ?? 0;
  const assurance = assuranceMensuelle(montantEmprunte, offre.tauxAssurance);
  const mensualiteTotale = mensualiteHorsAssurance + assurance;
  const totalInterets = sommer(tableau.map((l) => l.interets));
  const totalAssurance = sommer(tableau.map((l) => l.assurance));
  const capitalNet = montantEmprunte - frais;
  const taegAvecAssurance = taeg(capitalNet, tableau, true);

  return {
    aEmprunter: montantEmprunte > 0,
    besoin,
    montantEmprunte,
    fraisBancaires: frais,
    mensualiteHorsAssurance,
    assuranceMensuelle: assurance,
    mensualiteTotale,
    echeancier: echeancier(tableau),
    tableau,
    parAnnee: regrouperParAnnee(tableau),
    totalInterets,
    totalAssurance,
    totalMensualites: sommer(tableau.map((l) => l.mensualite + l.assurance)),
    coutTotalCredit: totalInterets + totalAssurance + frais,
    taegHorsAssurance: taeg(capitalNet, tableau, false),
    taegAvecAssurance,
    tauxUsure: regles.credit.tauxUsure,
    tauxUsureDepasse: (taegAvecAssurance ?? 0) > regles.credit.tauxUsure,
    endettement: tauxEndettement(mensualiteTotale, projet.revenusMensuels),
  };
}
