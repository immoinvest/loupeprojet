import type { BienGere, Changement, Locataire, LocationGeree, Paiement } from '../src/schemas';

/** Données de test réalistes : les biens et locataires de la maquette de Gérer. */

const CREE_LE = '2026-09-01T08:00:00.000Z';

export function bien(id: string, nom: string): BienGere {
  return {
    id,
    nom,
    adresse: `${nom}, Marseille`,
    type: 'appartement',
    meuble: true,
    creeLe: CREE_LE,
    modifieLe: CREE_LE,
  };
}

export function locataire(id: string, prenom: string, nom: string): Locataire {
  return { id, prenom, nom, creeLe: CREE_LE };
}

export interface OptionsLocation {
  readonly bienId?: string;
  readonly locataireId?: string;
  readonly colocataireIds?: readonly string[];
  readonly libelle?: string;
  readonly debut?: string;
  readonly fin?: string;
  readonly jourLoyer?: number;
  readonly loyerHorsCharges?: number;
  readonly charges?: number;
  readonly apl?: number;
  readonly changements?: readonly Changement[];
}

/** Par défaut : le T2 de Julie, meublé, 650 € + 50 € de charges, loyer le 5, depuis le 1er octobre 2025. */
export function location(id: string, options: OptionsLocation = {}): LocationGeree {
  const base: LocationGeree = {
    id,
    bienId: options.bienId ?? 'bien-lices',
    locataireId: options.locataireId ?? 'locataire-julie',
    colocataireIds: [...(options.colocataireIds ?? [])],
    ...(options.libelle === undefined ? {} : { libelle: options.libelle }),
    type: 'meublee',
    debut: options.debut ?? '2025-10-01',
    jourLoyer: options.jourLoyer ?? 5,
    loyerHorsCharges: options.loyerHorsCharges ?? 65_000,
    charges: options.charges ?? 5_000,
    ...(options.apl === undefined ? {} : { apl: options.apl }),
    depot: 130_000,
    ...(options.changements === undefined ? {} : { changements: [...options.changements] }),
    creeLe: CREE_LE,
  };
  return options.fin === undefined ? base : { ...base, fin: options.fin };
}

export function paiement(
  id: string,
  locationId: string,
  periode: string,
  montant: number,
  date = `${periode}-05`,
): Paiement {
  return { id, locationId, periode, montant, date, source: 'manuel', creeLe: CREE_LE };
}

/** Générateur pseudo-aléatoire à graine fixe (Park-Miller) : mêmes tirages à chaque exécution. */
export function tirage(graine: number): (min: number, max: number) => number {
  let etat = graine;
  return (min, max) => {
    etat = (etat * 48_271) % 2_147_483_647;
    return min + (etat % (max - min + 1));
  };
}
