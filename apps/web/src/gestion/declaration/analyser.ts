import type { BienGere } from '@loupe/gestion';

import type { ChampsExtraits } from '@/annonces';
import {
  valeursDepuisChamps,
  type ProvenanceValeurs,
  type ValeursInitiales,
} from '@/ecrans/formulaire/valeurs';

/*
 * « Analyser ce bien » (G5-2) : un bien géré sans analyse ouvre Nouveau projet, formulaire Vérifier
 * déjà rempli de ce que Gérer sait (type, surface, commune, meublé ou vide). Le prix d'achat, que
 * Gérer ignore, reste à saisir : un projet ne se crée pas sans prix.
 */

/** L'état de navigation que Nouveau projet lit. */
export interface EtatDepuisGestion {
  readonly depuisGestion: ChampsExtraits;
}

export function etatAnalyserBien(bien: BienGere): EtatDepuisGestion {
  return {
    depuisGestion: {
      typeBien: bien.type === 'maison' ? 'maison' : 'appartement',
      meuble: bien.meuble,
      mode: bien.meuble ? 'meuble' : 'nu',
      ...(bien.surface === undefined ? {} : { surface: bien.surface }),
      ...(bien.codePostal === undefined ? {} : { codePostal: bien.codePostal }),
      ...(bien.ville === undefined ? {} : { ville: bien.ville }),
    },
  };
}

/** Les champs apportés par « Analyser ce bien », ou `null` pour toute autre arrivée. */
export function champsDepuisGestion(etat: unknown): ChampsExtraits | null {
  if (typeof etat !== 'object' || etat === null || !('depuisGestion' in etat)) return null;
  const { depuisGestion } = etat;
  return typeof depuisGestion === 'object' && depuisGestion !== null ? depuisGestion : null;
}

/** Les valeurs du formulaire : ce que Gérer sait vient de l'utilisateur, pas d'une annonce. */
export function valeursDepuisGestion(champs: ChampsExtraits): ValeursInitiales {
  const initiales = valeursDepuisChamps(champs);
  const provenance = Object.fromEntries(
    Object.entries(initiales.provenance).map(([cle, p]) => [
      cle,
      p === 'annonce' ? 'utilisateur' : p,
    ]),
  ) as ProvenanceValeurs;
  return { valeurs: initiales.valeurs, provenance };
}
