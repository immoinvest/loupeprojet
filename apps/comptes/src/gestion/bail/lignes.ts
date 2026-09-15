import {
  LegalBienSchema,
  LettreRevisionCompleteSchema,
  LettreRevisionSchema,
  RevisionLocationSchema,
  type LegalBien,
  type LettreRevision,
  type LettreRevisionComplete,
  type RevisionLocation,
} from '@loupe/gestion';

import type { Ligne } from '../lignes';

/** Les lignes des tables de la migration 0008, relues et revalidées. */

export function versLegal(ligne: Ligne): LegalBien {
  return LegalBienSchema.parse({
    bienId: ligne.bienId,
    dpeClasse: ligne.dpeClasse ?? null,
    dpeDate: ligne.dpeDate ?? null,
    zoneTendue: typeof ligne.zoneTendue === 'number' ? ligne.zoneTendue === 1 : null,
    modifieLe: ligne.modifieLe,
  });
}

export function versRevision(ligne: Ligne): RevisionLocation {
  return RevisionLocationSchema.parse({
    locationId: ligne.locationId,
    active: ligne.active === 1,
    anniversaire: ligne.anniversaire,
    trimestre: ligne.trimestre,
    formeBail: ligne.formeBail,
    derniereRevision: ligne.derniereRevision ?? null,
    modifieLe: ligne.modifieLe,
  });
}

export function versLettre(ligne: Ligne): LettreRevision {
  return LettreRevisionSchema.parse({
    id: ligne.id,
    locationId: ligne.locationId,
    numero: ligne.numero,
    anniversaire: ligne.anniversaire,
    emisLe: ligne.emisLe,
  });
}

/** Le contenu figé, revalidé : un contenu abîmé est une erreur interne, jamais une lettre fausse. */
export function versLettreComplete(ligne: Ligne): LettreRevisionComplete {
  return LettreRevisionCompleteSchema.parse({
    ...versLettre(ligne),
    contenu: JSON.parse(String(ligne.contenu)) as unknown,
  });
}

/** L'instantané du projet d'un bien, s'il se relit comme un objet. */
export function lireInstantane(texte: unknown): Record<string, unknown> | undefined {
  if (typeof texte !== 'string') return undefined;
  try {
    const valeur: unknown = JSON.parse(texte);
    const objet = typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);
    return objet ? (valeur as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}
