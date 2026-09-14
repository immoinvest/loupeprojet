import type { Projet } from '@loupe/moteur';

import type { DpeAdresse } from './contrat';

/** Surface du DPE à 15 % près de celle du bien : c'est probablement le même logement. */
export const TOLERANCE_SURFACE_DPE = 0.15;

export type RaisonDpe = 'meme_adresse' | 'surface' | 'etage';

export interface DpePropose {
  readonly dpe: DpeAdresse;
  readonly raisons: readonly RaisonDpe[];
  readonly expire: boolean;
  /** DPE collectif, pour tout l'immeuble. */
  readonly immeuble: boolean;
}

export interface BienPourDpe {
  readonly surface: number;
  readonly etage?: number | undefined;
}

/** Clé BAN de l'adresse du bien, au format des DPE : `13205_6659_00144`. */
export function cleBanAdresse(
  codeInsee: string,
  codeVoie: string | null,
  numero: number | null,
): string | null {
  if (codeVoie === null || numero === null) return null;
  return `${codeInsee}_${codeVoie.toLowerCase()}_${String(numero).padStart(5, '0')}`;
}

const POIDS: Readonly<Record<RaisonDpe, number>> = { meme_adresse: 4, surface: 2, etage: 1 };

function raisonsDe(dpe: DpeAdresse, bien: BienPourDpe, cleBan: string | null): RaisonDpe[] {
  const raisons: RaisonDpe[] = [];
  if (cleBan !== null && dpe.cleBan?.toLowerCase() === cleBan) raisons.push('meme_adresse');
  if (
    dpe.surface !== null &&
    Math.abs(dpe.surface - bien.surface) <= bien.surface * TOLERANCE_SURFACE_DPE
  ) {
    raisons.push('surface');
  }
  if (bien.etage !== undefined && dpe.etage === bien.etage) raisons.push('etage');
  return raisons;
}

const score = (p: DpePropose): number =>
  p.raisons.reduce((s, r) => s + POIDS[r], 0) - (p.immeuble ? 0.5 : 0);

/**
 * Classe les DPE de l'adresse du plus probable au moins probable pour ce bien : même adresse BAN,
 * surface proche, même étage ; à égalité, le plus récent. `aujourdhui` au format AAAA-MM-JJ.
 */
export function classerDpe(
  liste: readonly DpeAdresse[],
  bien: BienPourDpe,
  cleBan: string | null,
  aujourdhui: string,
): DpePropose[] {
  return liste
    .map((dpe) => ({
      dpe,
      raisons: raisonsDe(dpe, bien, cleBan),
      expire: dpe.finValidite !== null && dpe.finValidite < aujourdhui,
      immeuble: dpe.typeBatiment === 'immeuble',
    }))
    .sort((a, b) => score(b) - score(a) || (b.dpe.date ?? '').localeCompare(a.dpe.date ?? ''));
}

/** Le DPE à mettre en avant : le premier du classement s'il ressemble au bien (surface ou étage). */
export function dpeSuggere(classes: readonly DpePropose[]): DpePropose | null {
  const [premier] = classes;
  return premier !== undefined &&
    (premier.raisons.includes('surface') || premier.raisons.includes('etage'))
    ? premier
    : null;
}

/** Applique un DPE au projet : étiquettes énergie et climat, provenance « ademe ». */
export function appliquerDpe(projet: Projet, dpe: DpeAdresse): Projet {
  return {
    ...projet,
    bien: {
      ...projet.bien,
      dpe: dpe.etiquetteDpe,
      ...(dpe.etiquetteGes === null ? {} : { ges: dpe.etiquetteGes }),
    },
    provenance: {
      ...projet.provenance,
      'bien.dpe': 'ademe',
      ...(dpe.etiquetteGes === null ? {} : { 'bien.ges': 'ademe' }),
    },
  };
}
