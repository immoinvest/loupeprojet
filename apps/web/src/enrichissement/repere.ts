import type { Projet } from '@loupe/moteur';

import type { MarcheAdresse } from './adresse';

/**
 * Le repère de prix de l'adresse s'applique tout seul après l'analyse (fiche 14), sauf quand la personne a
 * saisi le sien dans Hypothèses : on ne l'écrase jamais, on propose de le remplacer. Pur.
 */
export type DecisionRepere = 'appliquer' | 'deja' | 'proteger';

const PREFIXE_DVF = 'marche.dvf.';

export function repereSaisiALaMain(projet: Projet): boolean {
  return projet.provenance[`${PREFIXE_DVF}medianM2`] === 'utilisateur';
}

/** Même médiane, même nombre de ventes, même rayon : le projet porte déjà ce repère. */
export function memeRepere(projet: Projet, repere: MarcheAdresse): boolean {
  const dvf = projet.marche.dvf;
  return (
    dvf?.medianM2 === repere.dvf.medianM2 &&
    dvf.nombreVentes === repere.dvf.nombreVentes &&
    dvf.rayonMetres === repere.dvf.rayonMetres
  );
}

export function decisionRepere(projet: Projet, repere: MarcheAdresse): DecisionRepere {
  if (memeRepere(projet, repere)) return 'deja';
  return repereSaisiALaMain(projet) ? 'proteger' : 'appliquer';
}

/** Ce qu'il faut garder pour « Annuler » : le bloc `marche.dvf` et ses provenances. */
export interface InstantaneRepere {
  readonly dvf: Projet['marche']['dvf'];
  readonly provenance: Projet['provenance'];
}

function provenanceDvf(provenance: Projet['provenance'], garder: boolean): Projet['provenance'] {
  return Object.fromEntries(
    Object.entries(provenance).filter(([champ]) => champ.startsWith(PREFIXE_DVF) === garder),
  );
}

export function instantaneRepere(projet: Projet): InstantaneRepere {
  return { dvf: projet.marche.dvf, provenance: provenanceDvf(projet.provenance, true) };
}

/** Pose le repère de l'adresse ; les provenances de l'ancien repère disparaissent avec lui. */
export function appliquerRepere(projet: Projet, repere: MarcheAdresse): Projet {
  return {
    ...projet,
    marche: { ...projet.marche, dvf: repere.dvf },
    provenance: { ...provenanceDvf(projet.provenance, false), ...repere.provenance },
  };
}

/** Remet le repère gardé par `instantaneRepere` ; un projet qui n'en avait pas le perd. */
export function restaurerRepere(projet: Projet, instantane: InstantaneRepere): Projet {
  const marche = { ...projet.marche };
  delete marche.dvf;
  return {
    ...projet,
    marche: instantane.dvf === undefined ? marche : { ...marche, dvf: instantane.dvf },
    provenance: { ...provenanceDvf(projet.provenance, false), ...instantane.provenance },
  };
}
