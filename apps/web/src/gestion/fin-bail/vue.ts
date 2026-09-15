import {
  anneesARegulariser,
  depotTropEleve,
  locatairesDuMois,
  preavisLocataire,
  regularisationDeLAnnee,
  statutLocation,
  suiviDepot,
  type BienGere,
  type Conge,
  type ContextePreavis,
  type Depense,
  type EtatBail,
  type EtatFinBail,
  type EtatGestion,
  type Locataire,
  type LocationGeree,
  type ModeCharges,
  type Preavis,
  type PropositionRegularisation,
  type Regularisation,
  type Restitution,
  type StatutLocation,
  type SuiviDepot,
} from '@loupe/gestion';

import { legalDuBien, revisionDeLaLocation } from '../bail/vue';

/*
 * Ce que les écrans montrent de la fin du bail, déduit à l'affichage (jamais stocké) : préavis, dépôt,
 * charges, colocataires présents.
 */

type Donnees = Pick<EtatGestion, 'biens' | 'locataires' | 'locations' | 'paiements'>;

export function congeDe(etat: EtatFinBail, locationId: string): Conge | undefined {
  return etat.conges.find((c) => c.locationId === locationId);
}

export function restitutionDe(etat: EtatFinBail, locationId: string): Restitution | undefined {
  return etat.restitutions.find((r) => r.locationId === locationId);
}

/** Provisions régularisées chaque année, sauf forfait enregistré. */
export function modeChargesDe(etat: EtatFinBail, locationId: string): ModeCharges {
  return etat.charges.find((c) => c.locationId === locationId)?.mode ?? 'provision';
}

/** Où en est la location : à venir, active, en préavis (congé reçu), terminée. */
export function statutDe(
  location: LocationGeree,
  etat: EtatFinBail | null,
  aujourdhui: string,
): StatutLocation {
  return statutLocation(location, congeDe(etat ?? VIDE, location.id) !== undefined, aujourdhui);
}

const VIDE: EtatFinBail = {
  conges: [],
  charges: [],
  restitutions: [],
  regularisations: [],
  mouvements: [],
  decomptes: [],
};

/**
 * Ce qui décide du préavis : le type de la location, la forme du bail et la zone tendue de la vie du
 * bail (B1). Sans ces données, la zone tendue reste inconnue : Deklic propose le préavis le plus long.
 */
export function contextePreavis(
  location: LocationGeree,
  bien: BienGere | undefined,
  bail: EtatBail | null,
  reduit: boolean,
  aujourdhui: string,
): ContextePreavis {
  if (bail === null || bien === undefined) {
    return { type: location.type, formeBail: 'classique', zoneTendue: null, reduit };
  }
  return {
    type: location.type,
    formeBail: revisionDeLaLocation(location, bail, aujourdhui).formeBail,
    zoneTendue: legalDuBien(bien, bail).zoneTendue,
    reduit,
  };
}

export function preavisDe(contexte: ContextePreavis): Preavis {
  return preavisLocataire(contexte);
}

/** Le suivi du dépôt d'une location : à rendre, date limite, rappel, majoration de retard. */
export function depotDe(
  location: LocationGeree,
  etat: EtatFinBail | null,
  aujourdhui: string,
): SuiviDepot {
  return suiviDepot(location, restitutionDe(etat ?? VIDE, location.id), aujourdhui);
}

/** Un dépôt enregistré au-dessus du maximum légal : seulement signalé, jamais corrigé d'office. */
export function depotAuDessusDuMaximum(
  location: LocationGeree,
  bail: EtatBail | null,
  aujourdhui: string,
): boolean {
  const forme =
    bail === null ? 'classique' : revisionDeLaLocation(location, bail, aujourdhui).formeBail;
  return depotTropEleve(location.type, forme, location.loyerHorsCharges, location.depot);
}

export function regularisationsDe(etat: EtatFinBail, locationId: string): Regularisation[] {
  return etat.regularisations
    .filter((r) => r.locationId === locationId)
    .sort((a, b) => b.annee - a.annee);
}

/** Les années passées à régulariser qui ne l'ont pas encore été. */
export function anneesProposees(
  location: LocationGeree,
  etat: EtatFinBail,
  aujourdhui: string,
): number[] {
  const faites = new Set(regularisationsDe(etat, location.id).map((r) => r.annee));
  return anneesARegulariser(location, aujourdhui).filter((annee) => !faites.has(annee));
}

/** Le décompte proposé pour une année : provisions contre dépenses récupérables du bien (A1). */
export function propositionCharges(
  location: LocationGeree,
  donnees: Donnees,
  etat: EtatFinBail,
  depenses: readonly Depense[],
  annee: number,
): PropositionRegularisation {
  return regularisationDeLAnnee({
    location,
    locationsDuBien: donnees.locations.filter((l) => l.bienId === location.bienId),
    depenses,
    annee,
    mode: modeChargesDe(etat, location.id),
  });
}

/** Les locataires présents pendant un mois, dans l'ordre du bail (changements de colocataire compris). */
export function presentsDuMois(
  location: LocationGeree,
  donnees: Donnees,
  etat: EtatFinBail | null,
  periode: string,
): Locataire[] {
  return locatairesDuMois(location, (etat ?? VIDE).mouvements, periode).flatMap((id) =>
    donnees.locataires.filter((l) => l.id === id),
  );
}

/** Une ligne de « À faire » venue de la fin du bail. */
export type ActionFinBail =
  | {
      readonly type: 'depot';
      readonly location: LocationGeree;
      readonly bien: BienGere;
      readonly locataire: Locataire | undefined;
      readonly suivi: SuiviDepot;
    }
  | {
      readonly type: 'regularisation';
      readonly location: LocationGeree;
      readonly bien: BienGere;
      readonly locataire: Locataire | undefined;
      readonly annee: number;
      readonly solde: number;
    }
  | {
      readonly type: 'charges_a_regler';
      readonly location: LocationGeree;
      readonly bien: BienGere;
      readonly locataire: Locataire | undefined;
      readonly regularisation: Regularisation;
    };

interface Contexte {
  readonly location: LocationGeree;
  readonly bien: BienGere;
  readonly locataire: Locataire | undefined;
}

function contextes(donnees: Donnees): Contexte[] {
  const biens = [...donnees.biens].sort((a, b) =>
    a.nom.localeCompare(b.nom, 'fr', { numeric: true }),
  );
  return biens.flatMap((bien) =>
    donnees.locations
      .filter((l) => l.bienId === bien.id)
      .map((location) => ({
        location,
        bien,
        locataire: donnees.locataires.find((l) => l.id === location.locataireId),
      })),
  );
}

/**
 * Les dépôts à rendre (les plus en retard d'abord), puis les régularisations à valider, puis celles
 * validées dont l'échéance est arrivée sans être réglée. Rien n'est stocké (ADR-G22).
 */
export function actionsFinBail(
  donnees: Donnees,
  etat: EtatFinBail,
  depenses: readonly Depense[],
  aujourdhui: string,
): ActionFinBail[] {
  const tous = contextes(donnees);
  const depots = tous
    .map((c) => ({ ...c, suivi: depotDe(c.location, etat, aujourdhui) }))
    .filter((c) => c.suivi.statut === 'a_rendre' && c.suivi.rappel)
    .sort((a, b) => (a.suivi.dateLimite ?? '').localeCompare(b.suivi.dateLimite ?? ''))
    .map((c): ActionFinBail => ({ type: 'depot', ...c }));
  const aValider = tous.flatMap((c): ActionFinBail[] =>
    anneesProposees(c.location, etat, aujourdhui).flatMap((annee) => {
      const proposition = propositionCharges(c.location, donnees, etat, depenses, annee);
      return proposition.statut === 'proposee'
        ? [{ type: 'regularisation', ...c, annee, solde: proposition.solde }]
        : [];
    }),
  );
  const aRegler = tous.flatMap((c): ActionFinBail[] =>
    regularisationsDe(etat, c.location.id)
      .filter((r) => r.regleeLe === null && r.aPartirDe <= aujourdhui.slice(0, 7))
      .map((regularisation) => ({ type: 'charges_a_regler', ...c, regularisation })),
  );
  return [...depots, ...aValider, ...aRegler];
}

/** Une clé stable par action (une location peut avoir un dépôt et des charges à régler). */
export function cleActionFinBail(action: ActionFinBail): string {
  switch (action.type) {
    case 'depot':
      return `depot-${action.location.id}`;
    case 'regularisation':
      return `charges-${action.location.id}-${String(action.annee)}`;
    case 'charges_a_regler':
      return `regler-${action.regularisation.id}`;
  }
}

/**
 * Les locations d'un bien à solder : terminées, avec un dépôt encore à rendre ou des charges à
 * régulariser. La fiche du bien les montre sous les locations en cours.
 */
export function locationsASolder(
  donnees: Donnees,
  etat: EtatFinBail,
  bienId: string,
  aujourdhui: string,
): LocationGeree[] {
  return donnees.locations
    .filter((l) => l.bienId === bienId && l.fin !== undefined && l.fin < aujourdhui)
    .filter(
      (l) =>
        depotDe(l, etat, aujourdhui).statut === 'a_rendre' ||
        anneesProposees(l, etat, aujourdhui).length > 0 ||
        regularisationsDe(etat, l.id).some((r) => r.regleeLe === null),
    )
    .sort((a, b) => (b.fin ?? '').localeCompare(a.fin ?? ''));
}
