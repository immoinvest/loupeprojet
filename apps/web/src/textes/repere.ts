import type { ReferenceAdresse } from '@/enrichissement';
import { nombre } from '@/formatage/nombres';

import { LIBELLES_GROUPES, prixM2 } from './adresse';

/** Textes de la ligne qui dit, dans la carte Estimation, ce qu'est devenu le repère de l'adresse (fiche 14). */
export const PHRASES_REPERE = {
  annuler: 'Annuler',
  appliquer: 'Appliquer le repère de l’adresse',
  remplacer: 'Remplacer par le repère de l’adresse',
  protege: 'Votre repère saisi dans Hypothèses est conservé.',
} as const;

/** « même côté de la rue, 6 ventes comparables, médiane 3 600 €/m² ». */
function description(reference: ReferenceAdresse): string {
  const s = reference.statistiques;
  const ventes = `${nombre(s.ventes)} ${s.ventes > 1 ? 'ventes comparables' : 'vente comparable'}`;
  return `${LIBELLES_GROUPES[reference.code].toLowerCase()}, ${ventes}, médiane ${prixM2(s.medianeM2)}`;
}

/** « Repère appliqué : même côté de la rue, 6 ventes comparables, médiane 3 600 €/m². » */
export function phraseRepereApplique(reference: ReferenceAdresse): string {
  return `Repère appliqué : ${description(reference)}.`;
}

/** « Repère de l’adresse non appliqué : même côté de la rue, 6 ventes comparables, médiane 3 600 €/m². » */
export function phraseRepereNonApplique(reference: ReferenceAdresse): string {
  return `Repère de l’adresse non appliqué : ${description(reference)}.`;
}
