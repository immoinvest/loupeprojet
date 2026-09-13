import type { MarcheEntree } from './marche';
import type { ReferenceAdresse } from './contrat';

export interface VoieBan {
  /** Code de la voie (FANTOIR), le même que dans les ventes DVF. */
  readonly codeVoie: string;
  readonly numero: number | null;
}

const CLE_BAN = /^(\d{5}|2[AB]\d{3})_[0-9A-Za-z]{4}(_\d+)?(_[a-z]+)?$/;

/** `13205_6659_00144` → voie `6659`, numéro 144 ; `13205_0693` (rue seule) → numéro null. */
export function lireCleBan(cle: string | null | undefined): VoieBan | null {
  if (cle === undefined || cle === null || !CLE_BAN.test(cle)) return null;
  const parties = cle.split('_');
  return {
    codeVoie: parties.slice(1, 2).join('').toUpperCase(),
    numero: parties.length > 2 ? Number.parseInt(parties.slice(2, 3).join(''), 10) : null,
  };
}

export interface MarcheAdresse {
  readonly dvf: NonNullable<MarcheEntree['dvf']>;
  readonly provenance: Readonly<Record<string, string>>;
}

const CHAMPS_DVF = ['medianM2', 'q1M2', 'q3M2', 'nombreVentes', 'rayonMetres'] as const;

/** Repère de l'analyse d'adresse → bloc `marche.dvf` du moteur, provenance « donnée publique ». */
export function marcheDepuisReference(reference: ReferenceAdresse): MarcheAdresse {
  const { statistiques: s } = reference;
  const provenance: Record<string, string> = {};
  for (const champ of CHAMPS_DVF) provenance[`marche.dvf.${champ}`] = 'dvf';
  return {
    dvf: {
      medianM2: s.medianeM2,
      q1M2: s.q1M2,
      q3M2: s.q3M2,
      nombreVentes: s.ventes,
      rayonMetres: reference.rayonMetres,
    },
    provenance,
  };
}

/** Écart du prix au m² du bien à la médiane du repère : −0,22 = 22 % moins cher. */
export function ecartAuRepere(prixM2: number, medianeM2: number): number {
  return prixM2 / medianeM2 - 1;
}
