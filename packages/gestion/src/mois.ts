import {
  loyerDuMois,
  suivreLoyer,
  type LoyerDu,
  type StatutLoyer,
  type SuiviLoyer,
} from './loyers';
import type { BienGere, EtatGestion, Locataire, LocationGeree } from './schemas';

export interface LigneLoyer extends SuiviLoyer {
  readonly du: LoyerDu;
  readonly location: LocationGeree;
  readonly bien: BienGere | undefined;
  readonly locataire: Locataire | undefined;
}

export interface ResumeMois {
  readonly periode: string;
  /** En retard d'abord, puis partiels, attendus, à venir, reçus ; à statut égal, par date due puis par bien. */
  readonly lignes: readonly LigneLoyer[];
  readonly nombreRecus: number;
  readonly nombreEnRetard: number;
  /** Ce qui est reçu, plafonné au dû de chaque loyer (un trop-perçu ne gonfle pas le mois). */
  readonly montantRecu: number;
  readonly montantDu: number;
}

type Donnees = Pick<EtatGestion, 'biens' | 'locataires' | 'locations' | 'paiements'>;

const ORDRE: Readonly<Record<StatutLoyer, number>> = {
  en_retard: 0,
  partiel: 1,
  attendu: 2,
  a_venir: 3,
  recu: 4,
};

/** Un bien introuvable (données incohérentes) se range en tête plutôt que de faire échouer le tri. */
function nomDuBien(ligne: LigneLoyer): string {
  return ligne.bien?.nom ?? '';
}

function comparerLignes(a: LigneLoyer, b: LigneLoyer): number {
  return (
    ORDRE[a.statut] - ORDRE[b.statut] ||
    a.du.echeance.localeCompare(b.du.echeance) ||
    nomDuBien(a).localeCompare(nomDuBien(b), 'fr')
  );
}

/** Les loyers dus du mois, leur suivi à la date du jour, et les totaux de l'accueil. */
export function resumeDuMois(donnees: Donnees, periode: string, aujourdhui: string): ResumeMois {
  const lignes: LigneLoyer[] = [];
  for (const location of donnees.locations) {
    const du = loyerDuMois(location, periode);
    if (du === null) continue;
    lignes.push({
      du,
      location,
      bien: donnees.biens.find((b) => b.id === location.bienId),
      locataire: donnees.locataires.find((l) => l.id === location.locataireId),
      ...suivreLoyer(du, donnees.paiements, aujourdhui),
    });
  }
  lignes.sort(comparerLignes);
  return {
    periode,
    lignes,
    nombreRecus: lignes.filter((l) => l.statut === 'recu').length,
    nombreEnRetard: lignes.filter((l) => l.statut === 'en_retard').length,
    montantRecu: lignes.reduce((s, l) => s + Math.min(l.recu, l.du.total), 0),
    montantDu: lignes.reduce((s, l) => s + l.du.total, 0),
  };
}
