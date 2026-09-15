import { arrondirEuro } from '../commun/arrondi';
import { obtenirRegles } from '../regles';
import type { FourchetteM2, Regles } from '../regles/types';
import type { ClasseEnergie, EtatBien } from '../schema/bien';
import type { TravauxChoix } from '../schema/hypotheses';
import type { ProjetEntree } from '../schema/projet';

export type CodeLigneTravaux = 'etat' | 'renovation_energetique';

/** Une ligne du détail : surface × coût au m² (bas, estimé, haut). */
export interface LigneTravaux {
  readonly code: CodeLigneTravaux;
  readonly surface: number;
  readonly prixM2: FourchetteM2;
  /** Surface × coût au m², arrondi à l'euro. */
  readonly montant: FourchetteM2;
}

/** Travaux estimés d'un bien : TTC, hors aides, à confirmer par devis. */
export interface EstimationTravaux {
  readonly etat: EtatBien;
  /** Classe DPE qui ajoute la rénovation énergétique ; `null` sinon. */
  readonly dpe: ClasseEnergie | null;
  readonly lignes: readonly LigneTravaux[];
  /** Totaux arrondis au multiple des règles (la centaine d'euros). */
  readonly bas: number;
  readonly estime: number;
  readonly haut: number;
}

/** Ce que l'estimation lit du bien. */
export interface BienTravaux {
  readonly surface: number;
  readonly etat?: EtatBien | undefined;
  readonly dpe?: ClasseEnergie | undefined;
}

/** Les trois choix qui suivent l'estimation (« saisi » la laisse de côté). */
export type ChoixEstime = Exclude<TravauxChoix, 'saisi'>;

const fois = (f: FourchetteM2, k: number): FourchetteM2 => ({
  bas: f.bas * k,
  estime: f.estime * k,
  haut: f.haut * k,
});

function ligne(code: CodeLigneTravaux, surface: number, prixM2: FourchetteM2): LigneTravaux {
  return { code, surface, prixM2, montant: fois(prixM2, surface) };
}

/**
 * Travaux selon l'état du bien : surface × coût au m² de l'état, plus la rénovation énergétique si le
 * DPE est dans les classes des règles (la moitié pour un bien à rénover). `null` si l'état est inconnu.
 * Pure.
 */
export function estimerTravaux(bien: BienTravaux, regles: Regles): EstimationTravaux | null {
  const { etat, dpe, surface } = bien;
  if (etat === undefined) return null;
  const { parEtat, renovationEnergetique: energie, arrondi } = regles.travaux;
  const energetique = dpe !== undefined && energie.classes.includes(dpe);
  const part = etat === 'a_renover' ? energie.partSiARenover : 1;
  const lignes: LigneTravaux[] = [ligne('etat', surface, parEtat[etat])];
  if (energetique) lignes.push(ligne('renovation_energetique', surface, fois(energie, part)));
  const total = (cle: keyof FourchetteM2): number =>
    arrondirEuro(lignes.reduce((s, l) => s + l.montant[cle], 0) / arrondi) * arrondi;
  return {
    etat,
    dpe: energetique ? dpe : null,
    lignes: lignes.map((l) => ({
      ...l,
      montant: {
        bas: arrondirEuro(l.montant.bas),
        estime: arrondirEuro(l.montant.estime),
        haut: arrondirEuro(l.montant.haut),
      },
    })),
    bas: total('bas'),
    estime: total('estime'),
    haut: total('haut'),
  };
}

/** Le montant retenu pour un choix : la valeur estimée, le bas ou le haut de la fourchette. */
export function montantSelonChoix(estimation: EstimationTravaux, choix: ChoixEstime): number {
  return estimation[choix];
}

/**
 * Recalcule les travaux d'un projet qui suit l'estimation (choix estimé, bas ou haut) : à appeler après
 * un changement d'état, de surface ou de DPE. Un montant saisi, ou un projet sans choix, ne bouge pas.
 * État inconnu : 0 €, le choix est gardé pour reprendre dès que l'état est connu. Pure.
 */
export function recalerTravaux(projet: ProjetEntree): ProjetEntree {
  const { achat } = projet.hypotheses;
  const choix = achat.travauxChoix;
  if (choix === undefined || choix === 'saisi') return projet;
  const estimation = estimerTravaux(projet.bien, obtenirRegles(projet.versionRegles));
  const travaux = estimation === null ? 0 : montantSelonChoix(estimation, choix);
  return {
    ...projet,
    hypotheses: { ...projet.hypotheses, achat: { ...achat, travaux } },
    provenance: { ...(projet.provenance ?? {}), 'achat.travaux': 'estime' },
  };
}

/** Change le choix des travaux : un choix estimé recalcule le montant, « saisi » garde le montant actuel. */
export function choisirTravaux(projet: ProjetEntree, choix: TravauxChoix): ProjetEntree {
  const { achat } = projet.hypotheses;
  const suivant: ProjetEntree = {
    ...projet,
    hypotheses: { ...projet.hypotheses, achat: { ...achat, travauxChoix: choix } },
  };
  return recalerTravaux(suivant);
}
