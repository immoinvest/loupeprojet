import { sommer } from '../commun/flux';
import { loyerMensuelHc } from '../location/equivalents';
import type { Regles } from '../regles/types';
import type { Projet } from '../schema/projet';
import {
  crdFinAnnee,
  regrouperParAnnee,
  tableauAmortissement,
  type AnneeCredit,
  type LigneAmortissement,
  type PhaseCredit,
} from './amortissement';
import { tauxEffort, type TauxEffort } from './effort';
import { fraisAcquisition, type DetailFraisAcquisition } from './frais-acquisition';
import { ira } from './ira';
import { assuranceMensuelle } from './mensualite';
import { taeg } from './taeg';

export interface Echeance {
  readonly phase: PhaseCredit;
  readonly deMois: number;
  readonly aMois: number;
  readonly mensualiteHorsAssurance: number;
  readonly mensualiteTotale: number;
}

export interface ResultatFinancement {
  readonly fraisAcquisition: DetailFraisAcquisition;
  /** Prix + frais d'acquisition + travaux + mobilier + frais bancaires. */
  readonly coutTotalProjet: number;
  readonly montantEmprunte: number;
  /** Apport + mobilier (le mobilier n'est pas financé). */
  readonly miseDeDepart: number;
  readonly mensualiteHorsAssurance: number;
  readonly assuranceMensuelle: number;
  readonly mensualiteTotale: number;
  readonly echeancier: readonly Echeance[];
  readonly tableau: readonly LigneAmortissement[];
  readonly parAnnee: readonly AnneeCredit[];
  readonly totalInterets: number;
  readonly totalAssurance: number;
  /** Intérêts + assurance + frais de dossier + garantie. */
  readonly coutTotalCredit: number;
  readonly taegHorsAssurance: number | null;
  readonly taegAvecAssurance: number | null;
  readonly tauxUsureDepasse: boolean;
  readonly effort: TauxEffort;
  /** Capital restant dû et indemnité à la date de revente envisagée. */
  readonly crdRevente: number;
  readonly iraRevente: number;
}

/** Regroupe les mois consécutifs de même phase (repris de l'échéancier simplifié historique). */
export function echeancier(lignes: readonly LigneAmortissement[]): Echeance[] {
  const echeances: Echeance[] = [];
  for (const l of lignes) {
    const derniere = echeances.at(-1);
    if (derniere?.phase === l.phase) {
      echeances[echeances.length - 1] = { ...derniere, aMois: l.mois };
    } else {
      echeances.push({
        phase: l.phase,
        deMois: l.mois,
        aMois: l.mois,
        mensualiteHorsAssurance: l.mensualite,
        mensualiteTotale: l.mensualite + l.assurance,
      });
    }
  }
  return echeances;
}

export interface OptionsFinancement {
  /** Défaut `true`. Les TAEG coûtent deux résolutions numériques : inutiles pour un prix cible. */
  readonly avecTaeg?: boolean;
}

export function calculerFinancement(
  projet: Projet,
  regles: Regles,
  options: OptionsFinancement = {},
): ResultatFinancement {
  const { achat, pret, location, revente, revenusMensuels } = projet.hypotheses;
  const avecTaeg = options.avecTaeg ?? true;
  const frais = fraisAcquisition(achat, projet.bien.departement, regles);
  const fraisBancaires = pret.fraisDossier + pret.fraisGarantie;
  const besoinFinancement = achat.prix + achat.travaux + frais.total + fraisBancaires;
  const montantEmprunte = Math.max(0, besoinFinancement - pret.apport);

  const tableau = tableauAmortissement({
    capital: montantEmprunte,
    tauxAnnuel: pret.tauxNominal,
    dureeMois: pret.dureeAnnees * 12,
    differeTotalMois: pret.differeTotalMois,
    differePartielMois: pret.differePartielMois,
    tauxAssurance: pret.tauxAssurance,
  });
  const parAnnee = regrouperParAnnee(tableau);
  const mensualiteHorsAssurance = tableau.find((l) => l.phase === 'amortissement')?.mensualite ?? 0;
  const assurance = assuranceMensuelle(montantEmprunte, pret.tauxAssurance);
  const totalInterets = sommer(tableau.map((l) => l.interets));
  const totalAssurance = sommer(tableau.map((l) => l.assurance));
  const capitalNet = montantEmprunte - fraisBancaires;
  const taegAvecAssurance = avecTaeg ? taeg(capitalNet, tableau, true) : null;
  const crdRevente = crdFinAnnee(parAnnee, revente.annees);

  return {
    fraisAcquisition: frais,
    coutTotalProjet: besoinFinancement + achat.mobilier,
    montantEmprunte,
    miseDeDepart: pret.apport + achat.mobilier,
    mensualiteHorsAssurance,
    assuranceMensuelle: assurance,
    mensualiteTotale: mensualiteHorsAssurance + assurance,
    echeancier: echeancier(tableau),
    tableau,
    parAnnee,
    totalInterets,
    totalAssurance,
    coutTotalCredit: totalInterets + totalAssurance + fraisBancaires,
    taegHorsAssurance: avecTaeg ? taeg(capitalNet, tableau, false) : null,
    taegAvecAssurance,
    tauxUsureDepasse: (taegAvecAssurance ?? 0) > regles.credit.tauxUsure,
    effort: tauxEffort(
      {
        mensualiteTotale: mensualiteHorsAssurance + assurance,
        revenusMensuels,
        loyerMensuel: loyerMensuelHc(location),
        dureeAnnees: pret.dureeAnnees,
        travaux: achat.travaux,
        prix: achat.prix,
      },
      regles,
    ),
    crdRevente,
    iraRevente: ira(crdRevente, pret.tauxNominal, regles),
  };
}

export {
  crdFinAnnee,
  mensualiteAmortissement,
  regrouperParAnnee,
  tableauAmortissement,
  type AnneeCredit,
  type LigneAmortissement,
  type ParametresPret,
  type PhaseCredit,
} from './amortissement';
export { tauxEffort, type ParametresEffort, type TauxEffort } from './effort';
export {
  baseFraisAcquisition,
  emolumentsNotaireHt,
  fraisAcquisition,
  tauxDmto,
  type DetailFraisAcquisition,
} from './frais-acquisition';
export { ira } from './ira';
export { assuranceMensuelle, calculerMensualite } from './mensualite';
export { taeg } from './taeg';
