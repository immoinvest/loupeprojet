import { defautsPourMode } from '../location/defauts';
import { loyerMensuelHc, loyerMensuelReference } from '../location/equivalents';
import type { Regles } from '../regles/types';
import { regimesCompatibles, type Hypotheses, type Regime } from '../schema/hypotheses';
import type { Projet } from '../schema/projet';
import { avecPrix, prixCible } from './prix-cible';

export type CodeScenario =
  'negocier' | 'colocation' | 'duree' | 'tauxPlus050' | 'nu' | 'meuble' | 'vacance2Mois';

export interface Variante {
  readonly code: CodeScenario;
  readonly parametres: Readonly<Record<string, number | string>>;
  readonly projet: Projet;
}

/** `null` quand le scénario n'a pas de sens pour ce projet (déjà en colocation, par exemple). */
export type Transformation = (projet: Projet, regles: Regles) => Variante | null;

const REPLI_NEGOCIATION = 0.9;
const DUREE_ALTERNATIVE_ANNEES = 20;
const DUREE_COURTE_ANNEES = 15;
const HAUSSE_TAUX = 0.005;
const VACANCE_DEUX_MOIS_SEMAINES = 8;
const MOIS_VIDES_COURTE_DUREE = 2;
const MOIS_PAR_AN = 12;

function avecHypotheses(projet: Projet, patch: Partial<Hypotheses>): Projet {
  return { ...projet, hypotheses: { ...projet.hypotheses, ...patch } };
}

/** Le régime retenu s'il reste possible dans le nouveau type, sinon le réel meublé. */
function regimePour(regime: Regime, mode: Hypotheses['location']['mode']): Regime {
  return regimesCompatibles(mode).includes(regime) ? regime : 'lmnp_reel';
}

/**
 * Loyer meublé mensuel de référence du projet : en courte durée, le loyer de marché quand il est
 * connu (la nuitée ne dit rien d'un loyer mensuel) ; sinon l'équivalent du type.
 */
function loyerMeubleReference(projet: Projet, regles: Regles): number {
  const { location } = projet.hypotheses;
  const { loyerReferenceM2 } = projet.marche;
  if (location.mode === 'courte_duree' && loyerReferenceM2 !== undefined) {
    return loyerReferenceM2 * projet.bien.surface * (1 + regles.exploitation.primeMeuble);
  }
  return loyerMensuelReference(location, regles);
}

/** Prix auquel le cash-flow s'équilibre ; à défaut, −10 %. */
const negocier: Transformation = (projet, regles) => {
  const cible = prixCible(projet, 'cashflow_zero', regles);
  const prix = Math.round(cible.prix ?? projet.hypotheses.achat.prix * REPLI_NEGOCIATION);
  return { code: 'negocier', parametres: { prix }, projet: avecPrix(projet, prix) };
};

/** « Et si je passais en colocation » : la variante par défaut du type, chambres du bien. */
const colocation: Transformation = (projet, regles) => {
  const { location, charges, fiscalite } = projet.hypotheses;
  if (location.mode === 'colocation') return null;
  const chambres = projet.bien.chambres ?? Math.max(1, projet.bien.pieces - 1);
  const defauts = defautsPourMode('colocation', regles, {
    loyerMensuel: loyerMeubleReference(projet, regles),
    chambres,
  });
  const loyerParChambre = Math.round(loyerMensuelHc(defauts.location) / chambres);
  return {
    code: 'colocation',
    parametres: { chambres, loyerParChambre },
    projet: avecHypotheses(projet, {
      location: defauts.location,
      charges: {
        ...charges,
        energieMensuel:
          charges.energieMensuel > 0 ? charges.energieMensuel : defauts.charges.energieMensuel,
        internetMensuel:
          charges.internetMensuel > 0 ? charges.internetMensuel : defauts.charges.internetMensuel,
      },
      fiscalite: { ...fiscalite, regime: regimePour(fiscalite.regime, 'colocation') },
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

/**
 * Bascule nu → meublé (loyer majoré, LMNP réel), meublé → nu (loyer nu, régime nu réel) ; depuis une
 * colocation, une courte ou une moyenne durée : meublé longue durée au loyer de référence.
 */
const changerMode: Transformation = (projet, regles) => {
  const { location, fiscalite } = projet.hypotheses;
  const prime = 1 + regles.exploitation.primeMeuble;
  if (location.mode === 'nu') {
    const loyerHc = Math.round(location.loyerHc * prime);
    return {
      code: 'meuble',
      parametres: { loyerHc },
      projet: avecHypotheses(projet, {
        location: { ...location, mode: 'meuble', loyerHc },
        fiscalite: { ...fiscalite, regime: 'lmnp_reel' },
      }),
    };
  }
  if (location.mode === 'meuble') {
    const loyerHc = Math.round(location.loyerHcNu ?? location.loyerHc / prime);
    return {
      code: 'nu',
      parametres: { loyerHc },
      projet: avecHypotheses(projet, {
        location: {
          mode: 'nu',
          loyerHc,
          chargesLocataire: location.chargesLocataire,
          vacanceSemaines: location.vacanceSemaines,
          gestionTaux: location.gestionTaux,
        },
        fiscalite: { ...fiscalite, regime: 'nu_reel' },
      }),
    };
  }
  const loyerHc = Math.round(loyerMeubleReference(projet, regles));
  const defauts = regles.exploitation.parType.meuble;
  return {
    code: 'meuble',
    parametres: { loyerHc },
    projet: avecHypotheses(projet, {
      location: {
        mode: 'meuble',
        loyerHc,
        chargesLocataire: 0,
        vacanceSemaines: defauts.vacanceSemaines,
        gestionTaux: location.mode === 'courte_duree' ? defauts.gestionTaux : location.gestionTaux,
      },
    }),
  };
};

/** Deux mois vides par an ; en courte durée, deux mois de nuitées en moins. */
const vacance2Mois: Transformation = (projet) => {
  const { location } = projet.hypotheses;
  if (location.mode === 'courte_duree') {
    const nuiteesParMois =
      (location.nuiteesParMois * (MOIS_PAR_AN - MOIS_VIDES_COURTE_DUREE)) / MOIS_PAR_AN;
    return {
      code: 'vacance2Mois',
      parametres: { nuiteesParMois },
      projet: avecHypotheses(projet, { location: { ...location, nuiteesParMois } }),
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
