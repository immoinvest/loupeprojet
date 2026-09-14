import {
  VERSION_REGLES_COURANTE,
  defautsPourMode,
  obtenirRegles,
  type LocationEntree,
} from '@loupe/moteur';

import { loyerViseDepuisReference } from '@/enrichissement/loyer';
import type { MarcheEnrichi } from '@/enrichissement/marche';

import type { SaisieProjet } from './construire';

export interface LoyerRetenu {
  readonly valeur: number;
  readonly provenance: string;
}

export interface LocationConstruite {
  readonly location: LocationEntree;
  readonly charges: { readonly energieMensuel: number; readonly internetMensuel: number };
  readonly provenance: Record<string, string>;
}

/** Copie d'un objet sans l'une de ses clés : une variante sans son champ de loyer. */
function sansCle<T extends object, K extends keyof T>(objet: T, cle: K): Omit<T, K> {
  return Object.fromEntries(Object.entries(objet).filter(([k]) => k !== cle)) as Omit<T, K>;
}

/**
 * La location du type choisi : ce que l'utilisateur a saisi, complété par les défauts du type
 * (badgés « estimé »). Le loyer retenu vaut pour le logement entier ; en colocation il se répartit
 * entre les chambres, en courte durée il sert de référence pour la nuitée. Sans loyer retenu, la
 * variante n'a pas de champ de loyer : le rapport le demandera.
 */
export function construireLocation(s: SaisieProjet, loyer: LoyerRetenu | null): LocationConstruite {
  const regles = obtenirRegles(VERSION_REGLES_COURANTE);
  const { primeMeuble, primeColocation } = regles.exploitation;
  const chambres = s.chambresLouees ?? s.chambres ?? Math.max(1, (s.pieces ?? 2) - 1);
  const valeur = loyer?.valeur ?? 0;
  const loyerMensuel =
    s.mode === 'nu'
      ? valeur * (1 + primeMeuble)
      : s.mode === 'colocation'
        ? valeur / (1 + primeColocation)
        : valeur;
  const defauts = defautsPourMode(s.mode, regles, { loyerMensuel, chambres });
  const estimee = (cles: readonly string[]): Record<string, string> =>
    Object.fromEntries(cles.map((c) => [`location.${c}`, 'estime']));
  const provenanceLoyer = (cle: string): Record<string, string> =>
    loyer === null ? {} : { [`location.${cle}`]: loyer.provenance };
  switch (defauts.location.mode) {
    case 'nu':
    case 'meuble':
      return {
        location: {
          mode: defauts.location.mode,
          ...(loyer === null ? {} : { loyerHc: loyer.valeur }),
        },
        charges: defauts.charges,
        provenance: provenanceLoyer('loyerHc'),
      };
    case 'moyenne_duree':
      return {
        location:
          loyer === null
            ? sansCle(defauts.location, 'loyerHc')
            : { ...defauts.location, loyerHc: loyer.valeur },
        charges: defauts.charges,
        provenance: {
          ...provenanceLoyer('loyerHc'),
          ...estimee(['forfaitCharges', 'dureeSejourMois', 'vacanceSemaines']),
        },
      };
    case 'colocation': {
      const loyerChambre =
        s.loyerChambre ?? (loyer === null ? undefined : Math.round(loyer.valeur / chambres));
      return {
        location: {
          ...sansCle(defauts.location, 'loyerChambre'),
          chambres,
          ...(loyerChambre === undefined ? {} : { loyerChambre }),
        },
        charges: defauts.charges,
        provenance: {
          'location.chambres':
            s.chambresLouees !== undefined || s.chambres !== undefined ? 'utilisateur' : 'estime',
          ...(s.loyerChambre === undefined
            ? provenanceLoyer('loyerChambre')
            : { 'location.loyerChambre': 'utilisateur' }),
          ...estimee(['forfaitChargesChambre', 'vacanceSemaines']),
        },
      };
    }
    case 'courte_duree': {
      const nuitee = s.nuitee ?? (loyer === null ? undefined : defauts.location.nuitee);
      return {
        location: {
          ...sansCle(defauts.location, 'nuitee'),
          ...(nuitee === undefined ? {} : { nuitee }),
          ...(s.nuiteesParMois === undefined ? {} : { nuiteesParMois: s.nuiteesParMois }),
        },
        charges: defauts.charges,
        provenance: {
          ...(nuitee === undefined
            ? {}
            : { 'location.nuitee': s.nuitee === undefined ? 'estime' : 'utilisateur' }),
          'location.nuiteesParMois': s.nuiteesParMois === undefined ? 'estime' : 'utilisateur',
          ...estimee([
            'dureeSejourNuits',
            'menageFactureParSejour',
            'menageCoutParSejour',
            'plateformeTaux',
          ]),
        },
      };
    }
  }
}

/**
 * Le loyer visé : celui de la saisie (« Estimer le loyer » l'a pris dans les loyers ANIL, sinon il
 * vient de la personne), à défaut le loyer de marché de la commune ramené au bien, sinon rien.
 */
export function loyerRetenu(s: SaisieProjet, enrichi: MarcheEnrichi | null): LoyerRetenu | null {
  if (s.loyerHc !== undefined) {
    return {
      valeur: s.loyerHc,
      provenance: s.provenance.loyerHc === 'estime' ? 'anil' : 'utilisateur',
    };
  }
  const reference = enrichi?.marche.loyerReferenceM2;
  if (reference === undefined) return null;
  const { primeMeuble, primeColocation } = obtenirRegles(VERSION_REGLES_COURANTE).exploitation;
  const vise = loyerViseDepuisReference(reference, s.surface, s.mode, primeMeuble);
  return {
    valeur: s.mode === 'colocation' ? Math.round(vise * (1 + primeColocation)) : vise,
    provenance: 'anil',
  };
}
