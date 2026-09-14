import {
  avecChangement,
  changementRefuse,
  chevauche,
  ModificationLocationSchema,
  NouveauLocataireSchema,
  tropDeChangements,
  type EtatGestion,
  type Locataire,
  type LocationGeree,
  type RefusChangement,
} from '@loupe/gestion';

import type { CodeErreurGestion, ResultatGestion } from './types';

/** Ce qu'une action fait aux données du client mémoire, et sa réponse. */
export interface Effet<T> {
  readonly donnees: EtatGestion;
  readonly resultat: ResultatGestion<T>;
}

const CODES_REFUS_CHANGEMENT: Readonly<Record<RefusChangement, CodeErreurGestion>> = {
  HORS_LOCATION: 'invalide',
  PERIODE_PAYEE: 'periode_payee',
};

function refus<T>(donnees: EtatGestion, code: CodeErreurGestion): Effet<T> {
  return { donnees, resultat: { ok: false, code } };
}

/** La location avec ce libellé, ou sans libellé du tout. */
function avecLibelle(location: LocationGeree, libelle: string | undefined): LocationGeree {
  const copie = { ...location };
  delete copie.libelle;
  return libelle === undefined ? copie : { ...copie, libelle };
}

/** « Modifier » une location comme l'API : montants à partir d'un mois non payé, jour, dépôt, libellé. */
export function modifierEnMemoire(
  donnees: EtatGestion,
  locationId: string,
  modification: unknown,
  aujourdhui: string,
): Effet<LocationGeree> {
  const lu = ModificationLocationSchema.safeParse(modification);
  if (!lu.success) return refus(donnees, 'invalide');
  const location = donnees.locations.find((l) => l.id === locationId);
  if (location === undefined) return refus(donnees, 'introuvable');
  const { montants, jourLoyer, depot, libelle } = lu.data;
  if (montants !== undefined) {
    const code = changementRefuse(location, donnees.paiements, montants.aPartirDe, aujourdhui);
    if (code !== null) return refus(donnees, CODES_REFUS_CHANGEMENT[code]);
    if (tropDeChangements(location, montants.aPartirDe)) return refus(donnees, 'limite');
  }
  if (libelle !== undefined) {
    const autres = donnees.locations.filter(
      (l) => l.bienId === location.bienId && l.id !== location.id,
    );
    const nouvelle = {
      debut: location.debut,
      ...(location.fin === undefined ? {} : { fin: location.fin }),
      ...(libelle === null ? {} : { libelle }),
    };
    if (chevauche(autres, nouvelle)) return refus(donnees, 'bien_occupe');
  }

  const avecMontants = montants === undefined ? location : avecChangement(location, montants);
  const modifiee = avecLibelle(
    {
      ...avecMontants,
      jourLoyer: jourLoyer ?? location.jourLoyer,
      depot: depot ?? location.depot,
    },
    libelle === undefined ? location.libelle : (libelle ?? undefined),
  );
  return {
    donnees: {
      ...donnees,
      locations: donnees.locations.map((l) => (l.id === locationId ? modifiee : l)),
    },
    resultat: { ok: true, valeur: modifiee },
  };
}

/**
 * L'état sans le bien : ses locations, leurs paiements et documents, et les locataires qui n'ont
 * plus aucune location (comme l'API et ses clés étrangères en cascade).
 */
export function retirerBien(donnees: EtatGestion, bienId: string): EtatGestion {
  const partantes = new Set(donnees.locations.filter((l) => l.bienId === bienId).map((l) => l.id));
  const locations = donnees.locations.filter((l) => !partantes.has(l.id));
  const locataires = new Set(locations.flatMap((l) => [l.locataireId, ...l.colocataireIds]));
  return {
    ...donnees,
    biens: donnees.biens.filter((b) => b.id !== bienId),
    locations,
    locataires: donnees.locataires.filter((l) => locataires.has(l.id)),
    paiements: donnees.paiements.filter((p) => !partantes.has(p.locationId)),
    documents: donnees.documents.filter((d) => !partantes.has(d.locationId)),
  };
}

export function supprimerEnMemoire(donnees: EtatGestion, bienId: string): Effet<undefined> {
  if (!donnees.biens.some((b) => b.id === bienId)) return refus(donnees, 'introuvable');
  return { donnees: retirerBien(donnees, bienId), resultat: { ok: true, valeur: undefined } };
}

/** Nom et e-mail du locataire, comme l'API : identifiant et date de création gardés, e-mail absent retiré. */
export function modifierLocataireEnMemoire(
  donnees: EtatGestion,
  locataireId: string,
  locataire: unknown,
): Effet<Locataire> {
  const lu = NouveauLocataireSchema.safeParse(locataire);
  if (!lu.success) return refus(donnees, 'invalide');
  const existant = donnees.locataires.find((l) => l.id === locataireId);
  if (existant === undefined) return refus(donnees, 'introuvable');
  const modifie: Locataire = { id: existant.id, ...lu.data, creeLe: existant.creeLe };
  return {
    donnees: {
      ...donnees,
      locataires: donnees.locataires.map((l) => (l.id === locataireId ? modifie : l)),
    },
    resultat: { ok: true, valeur: modifie },
  };
}
