import {
  alertesConformite,
  classeDpeDuProjet,
  estUrgente,
  propositionRevision,
  revisionParDefaut,
  type AlerteConformite,
  type BienGere,
  type ClasseDpe,
  type EtatBail,
  type EtatGestion,
  type LettreRevision,
  type Locataire,
  type LocationGeree,
  type PropositionProposee,
  type PropositionRevision,
  type RevisionLocation,
} from '@loupe/gestion';

/*
 * Ce que les écrans montrent de la vie du bail, déduit à l'affichage (jamais stocké) : valeurs
 * enregistrées par le bailleur, sinon reprises de l'analyse ou par défaut (ADR-G28).
 */

type Donnees = Pick<EtatGestion, 'biens' | 'locataires' | 'locations' | 'paiements'>;

/** D'où vient une valeur affichée : badge « à toi », « analyse », « par défaut », ou rien de connu. */
export type Provenance = 'saisie' | 'analyse' | 'par_defaut' | 'aucune';

export interface LegalEffectif {
  readonly dpeClasse: ClasseDpe | null;
  readonly dpeDate: string | null;
  readonly zoneTendue: boolean | null;
  readonly provenance: Provenance;
}

export function legalDuBien(bien: BienGere, bail: EtatBail): LegalEffectif {
  const saisi = bail.biens.find((b) => b.bienId === bien.id);
  if (saisi !== undefined) {
    const { dpeClasse, dpeDate, zoneTendue } = saisi;
    return { dpeClasse, dpeDate, zoneTendue, provenance: 'saisie' };
  }
  const analyse = classeDpeDuProjet(bien.projet);
  return {
    dpeClasse: analyse,
    dpeDate: null,
    zoneTendue: null,
    provenance: analyse === null ? 'aucune' : 'analyse',
  };
}

export type RevisionEffective = RevisionLocation & { readonly provenance: Provenance };

export function revisionDeLaLocation(
  location: LocationGeree,
  bail: EtatBail,
  aujourdhui: string,
): RevisionEffective {
  const saisie = bail.revisions.find((r) => r.locationId === location.id);
  if (saisie !== undefined) return { ...saisie, provenance: 'saisie' };
  return {
    locationId: location.id,
    ...revisionParDefaut(location, aujourdhui),
    derniereRevision: null,
    modifieLe: location.creeLe,
    provenance: 'par_defaut',
  };
}

export function propositionDe(
  location: LocationGeree,
  donnees: Donnees,
  bail: EtatBail,
  aujourdhui: string,
): PropositionRevision {
  const bien = donnees.biens.find((b) => b.id === location.bienId);
  return propositionRevision({
    location,
    paiements: donnees.paiements,
    revision: revisionDeLaLocation(location, bail, aujourdhui),
    classeDpe: bien === undefined ? null : legalDuBien(bien, bail).dpeClasse,
    aujourdhui,
  });
}

/** Les locations du bien en cours ou à venir (celles qu'une alerte ou une révision concerne). */
function locationsActives(donnees: Donnees, bienId: string, aujourdhui: string): LocationGeree[] {
  return donnees.locations.filter(
    (l) => l.bienId === bienId && (l.fin === undefined || l.fin >= aujourdhui),
  );
}

export function alertesDuBien(
  bien: BienGere,
  donnees: Donnees,
  bail: EtatBail,
  aujourdhui: string,
): AlerteConformite[] {
  const legal = legalDuBien(bien, bail);
  return alertesConformite({
    codePostal: bien.codePostal,
    dpeClasse: legal.dpeClasse,
    dpeDate: legal.dpeDate,
    locations: locationsActives(donnees, bien.id, aujourdhui).map((l) => ({
      id: l.id,
      fin: l.fin,
      formeBail: revisionDeLaLocation(l, bail, aujourdhui).formeBail,
    })),
    aujourdhui,
  });
}

/** Une ligne de « À faire » venue de la vie du bail. */
export type ActionBail =
  | { readonly type: 'alerte'; readonly alerte: AlerteConformite; readonly bien: BienGere }
  | {
      readonly type: 'revision';
      readonly proposition: PropositionProposee;
      readonly location: LocationGeree;
      readonly bien: BienGere;
      /** Le locataire en titre, s'il est retrouvé. */
      readonly locataire: Locataire | undefined;
    };

const parNom = (a: BienGere, b: BienGere): number =>
  a.nom.localeCompare(b.nom, 'fr', { numeric: true });

/** Les alertes urgentes des biens (par nom), puis les révisions à valider (par nom de bien). */
export function actionsBail(donnees: Donnees, bail: EtatBail, aujourdhui: string): ActionBail[] {
  const biens = [...donnees.biens].sort(parNom);
  const alertes = biens.flatMap((bien) =>
    alertesDuBien(bien, donnees, bail, aujourdhui)
      .filter(estUrgente)
      .map((alerte): ActionBail => ({ type: 'alerte', alerte, bien })),
  );
  const revisions = biens.flatMap((bien) =>
    locationsActives(donnees, bien.id, aujourdhui).flatMap((location): ActionBail[] => {
      const proposition = propositionDe(location, donnees, bail, aujourdhui);
      const locataire = donnees.locataires.find((l) => l.id === location.locataireId);
      return proposition.statut === 'proposee'
        ? [{ type: 'revision', proposition, location, bien, locataire }]
        : [];
    }),
  );
  return [...alertes, ...revisions];
}

/** La lettre de la dernière révision appliquée d'une location, si elle est dans l'état. */
export function derniereLettre(bail: EtatBail, locationId: string): LettreRevision | undefined {
  return bail.lettres
    .filter((l) => l.locationId === locationId)
    .sort((a, b) => b.anniversaire.localeCompare(a.anniversaire))[0];
}
