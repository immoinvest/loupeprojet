import {
  ClasseEnergieSchema,
  EtatBienSchema,
  VERSION_REGLES_COURANTE,
  estimerTravaux,
  obtenirRegles,
  type EstimationTravaux,
} from '@loupe/moteur';

import { nombre, type Valeurs } from '@/ecrans/formulaire/valeurs';

/**
 * Les travaux que le projet recevra si aucun montant n'est saisi : l'estimation selon l'état, la surface
 * et le DPE du formulaire. `null` avec un montant saisi, sans état ou sans surface.
 */
export function travauxEstimesDe(v: Valeurs): EstimationTravaux | null {
  if (v.travaux.trim() !== '') return null;
  const etat = EtatBienSchema.safeParse(v.etat);
  const surface = nombre(v.surface);
  if (!etat.success || surface === undefined || surface <= 0) return null;
  const dpe = ClasseEnergieSchema.safeParse(v.dpe);
  return estimerTravaux(
    { surface, etat: etat.data, dpe: dpe.success ? dpe.data : undefined },
    obtenirRegles(VERSION_REGLES_COURANTE),
  );
}
