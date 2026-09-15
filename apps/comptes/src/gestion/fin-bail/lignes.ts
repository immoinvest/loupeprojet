import {
  CongeSchema,
  DecompteCompletSchema,
  DecompteSchema,
  ModeChargesLocationSchema,
  MouvementColocationSchema,
  RegularisationSchema,
  RestitutionSchema,
  type Conge,
  type Decompte,
  type DecompteComplet,
  type ModeChargesLocation,
  type MouvementColocation,
  type Regularisation,
  type Restitution,
} from '@loupe/gestion';

import type { Ligne } from '../lignes';

/** Les lignes des tables de la migration 0011, relues et revalidées. */

export function versConge(ligne: Ligne): Conge {
  return CongeSchema.parse({
    locationId: ligne.locationId,
    recuLe: ligne.recuLe,
    fin: ligne.fin,
    reduit: ligne.reduit === 1,
    modifieLe: ligne.modifieLe,
  });
}

export function versModeCharges(ligne: Ligne): ModeChargesLocation {
  return ModeChargesLocationSchema.parse({
    locationId: ligne.locationId,
    mode: ligne.mode,
    modifieLe: ligne.modifieLe,
  });
}

/** Les retenues sont un texte JSON relu par Zod : un contenu abîmé est une erreur interne. */
export function versRestitution(ligne: Ligne): Restitution {
  return RestitutionSchema.parse({
    locationId: ligne.locationId,
    clesLe: ligne.clesLe,
    conforme: ligne.conforme === 1,
    retenues: JSON.parse(String(ligne.retenues)) as unknown,
    depot: ligne.depot,
    aRendre: ligne.aRendre,
    dateLimite: ligne.dateLimite,
    decompteId: ligne.decompteId,
    rendueLe: ligne.rendueLe ?? null,
    modifieLe: ligne.modifieLe,
  });
}

export function versRegularisation(ligne: Ligne): Regularisation {
  return RegularisationSchema.parse({
    id: ligne.id,
    locationId: ligne.locationId,
    annee: ligne.annee,
    solde: ligne.solde,
    aPartirDe: ligne.aPartirDe,
    decompteId: ligne.decompteId,
    regleeLe: ligne.regleeLe ?? null,
    creeLe: ligne.creeLe,
  });
}

export function versMouvement(ligne: Ligne): MouvementColocation {
  return MouvementColocationSchema.parse({
    id: ligne.id,
    locationId: ligne.locationId,
    locataireId: ligne.locataireId,
    sens: ligne.sens,
    date: ligne.date,
    creeLe: ligne.creeLe,
  });
}

export function versDecompte(ligne: Ligne): Decompte {
  return DecompteSchema.parse({
    id: ligne.id,
    type: ligne.type,
    locationId: ligne.locationId,
    numero: ligne.numero,
    emisLe: ligne.emisLe,
  });
}

/** Le contenu figé, revalidé : jamais un décompte faux. */
export function versDecompteComplet(ligne: Ligne): DecompteComplet {
  return DecompteCompletSchema.parse({
    ...versDecompte(ligne),
    contenu: JSON.parse(String(ligne.contenu)) as unknown,
  });
}
