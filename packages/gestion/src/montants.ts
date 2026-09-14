import { ajouterMois, periodeDe, periodeSuivante } from './dates';
import { HORIZON_MODIFICATION_MOIS } from './regles';
import type { Changement, LocationGeree, Paiement } from './schemas';

/*
 * Les montants d'une location changent « à partir d'un mois » (ADR-G14) : les montants d'entrée
 * restent sur la location, chaque changement vaut du mois indiqué jusqu'au suivant. Un mois qui a
 * reçu un paiement garde ses montants (ADR-G15) : le passé, les paiements et les documents ne bougent pas.
 */

/** Ce qu'une location demande pour un mois plein : loyer, charges, et aide au logement comprise. */
export interface Montants {
  readonly loyerHorsCharges: number;
  readonly charges: number;
  readonly apl: number;
  /** Le mois du changement appliqué ; absent pour les montants d'entrée. */
  readonly aPartirDe?: string;
}

type AvecMontants = Pick<LocationGeree, 'loyerHorsCharges' | 'charges' | 'apl' | 'changements'>;
type Bornes = Pick<LocationGeree, 'id' | 'debut' | 'fin'>;

export type RefusChangement = 'HORS_LOCATION' | 'PERIODE_PAYEE';

/** Les montants en vigueur pour un mois : le dernier changement commencé, sinon les montants d'entrée. */
export function montantsDuMois(location: AvecMontants, periode: string): Montants {
  let retenu: Changement | undefined;
  for (const changement of location.changements ?? []) {
    if (
      changement.aPartirDe <= periode &&
      (retenu === undefined || changement.aPartirDe > retenu.aPartirDe)
    ) {
      retenu = changement;
    }
  }
  return (
    retenu ?? {
      loyerHorsCharges: location.loyerHorsCharges,
      charges: location.charges,
      apl: location.apl ?? 0,
    }
  );
}

/** Le premier mois dont les montants peuvent changer : celui qui suit le dernier mois payé, sinon l'entrée. */
export function premierMoisModifiable(location: Bornes, paiements: readonly Paiement[]): string {
  let dernierPaye: string | null = null;
  for (const p of paiements) {
    if (p.locationId === location.id && (dernierPaye === null || p.periode > dernierPaye)) {
      dernierPaye = p.periode;
    }
  }
  return dernierPaye === null ? periodeDe(location.debut) : periodeSuivante(dernierPaye);
}

/** Le dernier mois qu'un changement peut viser : la sortie, ou un an après le mois en cours si elle vient après. */
function dernierMoisModifiable(location: Bornes, aujourdhui: string): string {
  const horizon = ajouterMois(periodeDe(aujourdhui), HORIZON_MODIFICATION_MOIS);
  const sortie = location.fin === undefined ? horizon : periodeDe(location.fin);
  return sortie < horizon ? sortie : horizon;
}

/** Les mois proposés par « À partir de », du premier modifiable au dernier ; vide si tout est payé. */
export function moisModifiables(
  location: Bornes,
  paiements: readonly Paiement[],
  aujourdhui: string,
): string[] {
  const mois: string[] = [];
  const dernier = dernierMoisModifiable(location, aujourdhui);
  for (let p = premierMoisModifiable(location, paiements); p <= dernier; p = periodeSuivante(p)) {
    mois.push(p);
  }
  return mois;
}

/** Pourquoi un changement à partir de ce mois serait refusé, ou `null` s'il est accepté. */
export function changementRefuse(
  location: Bornes,
  paiements: readonly Paiement[],
  aPartirDe: string,
  aujourdhui: string,
): RefusChangement | null {
  if (
    aPartirDe < periodeDe(location.debut) ||
    aPartirDe > dernierMoisModifiable(location, aujourdhui)
  ) {
    return 'HORS_LOCATION';
  }
  return aPartirDe < premierMoisModifiable(location, paiements) ? 'PERIODE_PAYEE' : null;
}

/** La location avec ce changement, rangé dans l'ordre des mois ; un changement du même mois est remplacé. */
export function avecChangement<L extends Pick<LocationGeree, 'changements'>>(
  location: L,
  changement: Changement,
): L {
  const autres = (location.changements ?? []).filter((c) => c.aPartirDe !== changement.aPartirDe);
  return {
    ...location,
    changements: [...autres, changement].sort((a, b) => a.aPartirDe.localeCompare(b.aPartirDe)),
  };
}
