import type { Regles } from '../regles/types';
import type { Hypotheses } from '../schema/hypotheses';
import type { Projet } from '../schema/projet';
import { avecPrix, prixCible } from './prix-cible';

export type CodeScenario =
  'negocier' | 'colocation' | 'duree' | 'tauxPlus050' | 'nu' | 'meuble' | 'vacance2Mois';

export interface Variante {
  readonly code: CodeScenario;
  readonly parametres: Readonly<Record<string, number | string>>;
  readonly projet: Projet;
}

type Transformation = (projet: Projet, regles: Regles) => Variante;

const REPLI_NEGOCIATION = 0.9;
const DUREE_ALTERNATIVE_ANNEES = 20;
const DUREE_COURTE_ANNEES = 15;
const HAUSSE_TAUX = 0.005;
const VACANCE_DEUX_MOIS_SEMAINES = 8;
const BAISSE_OCCUPATION_COURTE_DUREE = 0.15;

function avecHypotheses(projet: Projet, patch: Partial<Hypotheses>): Projet {
  return { ...projet, hypotheses: { ...projet.hypotheses, ...patch } };
}

/** Prix auquel le cash-flow s'équilibre ; à défaut, −10 %. */
const negocier: Transformation = (projet, regles) => {
  const cible = prixCible(projet, 'cashflow_zero', regles);
  const prix = Math.round(cible.prix ?? projet.hypotheses.achat.prix * REPLI_NEGOCIATION);
  return { code: 'negocier', parametres: { prix }, projet: avecPrix(projet, prix) };
};

/** Loyer total majoré de la prime colocation, vacance de colocation, meublé. */
const colocation: Transformation = (projet, regles) => {
  const { location } = projet.hypotheses;
  const chambres = projet.bien.chambres ?? Math.max(1, projet.bien.pieces - 1);
  const loyerTotal = location.loyerHc * (1 + regles.exploitation.primeColocation);
  const loyerParChambre = Math.round(loyerTotal / chambres);
  return {
    code: 'colocation',
    parametres: { chambres, loyerParChambre },
    projet: avecHypotheses(projet, {
      location: {
        ...location,
        mode: 'meuble_lld',
        loyerHc: loyerParChambre * chambres,
        vacanceSemaines: regles.exploitation.vacanceSemainesColocation,
      },
    }),
  };
};

/** 20 ans, ou 15 ans si le prêt fait déjà 20 ans. */
const duree: Transformation = (projet) => {
  const actuelle = projet.hypotheses.pret.dureeAnnees;
  const dureeAnnees =
    actuelle === DUREE_ALTERNATIVE_ANNEES ? DUREE_COURTE_ANNEES : DUREE_ALTERNATIVE_ANNEES;
  return {
    code: 'duree',
    parametres: { dureeAnnees },
    projet: avecHypotheses(projet, { pret: { ...projet.hypotheses.pret, dureeAnnees } }),
  };
};

const tauxPlus050: Transformation = (projet) => {
  const tauxNominal = projet.hypotheses.pret.tauxNominal + HAUSSE_TAUX;
  return {
    code: 'tauxPlus050',
    parametres: { tauxNominal },
    projet: avecHypotheses(projet, { pret: { ...projet.hypotheses.pret, tauxNominal } }),
  };
};

/** Bascule meublé → nu (loyer nu, régime nu réel) ou nu → meublé (loyer majoré, LMNP réel). */
const changerMode: Transformation = (projet, regles) => {
  const { location, fiscalite } = projet.hypotheses;
  const prime = 1 + regles.exploitation.primeMeuble;
  if (location.mode === 'nu') {
    const loyerHc = Math.round(location.loyerHc * prime);
    return {
      code: 'meuble',
      parametres: { loyerHc },
      projet: avecHypotheses(projet, {
        location: { ...location, mode: 'meuble_lld', loyerHc },
        fiscalite: { ...fiscalite, regime: 'lmnp_reel' },
      }),
    };
  }
  const loyerHc = Math.round(location.loyerHcNu ?? location.loyerHc / prime);
  return {
    code: 'nu',
    parametres: { loyerHc },
    projet: avecHypotheses(projet, {
      location: { ...location, mode: 'nu', loyerHc },
      fiscalite: { ...fiscalite, regime: 'nu_reel' },
    }),
  };
};

/** Deux mois vides par an ; en courte durée, 15 points d'occupation en moins. */
const vacance2Mois: Transformation = (projet) => {
  const { location } = projet.hypotheses;
  if (location.mode === 'courte_duree' && location.courteDuree !== undefined) {
    const tauxOccupation = Math.max(
      0,
      location.courteDuree.tauxOccupation - BAISSE_OCCUPATION_COURTE_DUREE,
    );
    return {
      code: 'vacance2Mois',
      parametres: { tauxOccupation },
      projet: avecHypotheses(projet, {
        location: { ...location, courteDuree: { ...location.courteDuree, tauxOccupation } },
      }),
    };
  }
  return {
    code: 'vacance2Mois',
    parametres: { vacanceSemaines: VACANCE_DEUX_MOIS_SEMAINES },
    projet: avecHypotheses(projet, {
      location: { ...location, vacanceSemaines: VACANCE_DEUX_MOIS_SEMAINES },
    }),
  };
};

export const TRANSFORMATIONS: readonly Transformation[] = [
  negocier,
  colocation,
  duree,
  tauxPlus050,
  changerMode,
  vacance2Mois,
];
