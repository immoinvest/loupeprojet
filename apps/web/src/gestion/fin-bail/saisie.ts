import {
  finDePreavis,
  JourSchema,
  MOTIF_RETENUE_MAX,
  RETENUES_MAX,
  type ChangementColocataire,
  type CongeSaisie,
  type ContextePreavis,
  type NouveauLocataire,
  type RestitutionSaisie,
} from '@loupe/gestion';

import { centimesDepuisTexte, decouperNom } from '../saisie';

/*
 * Les formulaires de la fin du bail, en texte comme ils sont tapés : congé, restitution du dépôt,
 * changement de colocataire. Chaque lecture rend ce qu'on envoie, ou les champs à corriger.
 */

export interface SaisieConge {
  /** Jour de réception du congé (par défaut aujourd'hui). */
  readonly recuLe: string;
  /** La sortie, calculée par Deklic et modifiable. */
  readonly fin: string;
  /** Le locataire invoque un motif de préavis réduit. */
  readonly reduit: boolean;
}

export type ChampConge = 'recuLe' | 'fin';

export type LectureConge =
  | { readonly ok: true; readonly conge: CongeSaisie }
  | { readonly ok: false; readonly erreurs: readonly ChampConge[] };

/** Le formulaire ouvert : congé reçu aujourd'hui, sortie à la fin du préavis. */
export function saisieCongeInitiale(contexte: ContextePreavis, aujourdhui: string): SaisieConge {
  return { recuLe: aujourdhui, fin: finDePreavis(aujourdhui, contexte), reduit: contexte.reduit };
}

/** La sortie recalculée quand la réception ou le motif change (le bailleur peut encore la corriger). */
export function congeRecalcule(
  saisie: SaisieConge,
  contexte: Omit<ContextePreavis, 'reduit'>,
): SaisieConge {
  const complet = { ...contexte, reduit: saisie.reduit };
  return JourSchema.safeParse(saisie.recuLe).success
    ? { ...saisie, fin: finDePreavis(saisie.recuLe, complet) }
    : saisie;
}

export function lireConge(saisie: SaisieConge): LectureConge {
  const erreurs: ChampConge[] = [];
  if (!JourSchema.safeParse(saisie.recuLe).success) erreurs.push('recuLe');
  if (!JourSchema.safeParse(saisie.fin).success || saisie.fin < saisie.recuLe) erreurs.push('fin');
  if (erreurs.length > 0) return { ok: false, erreurs };
  return { ok: true, conge: { recuLe: saisie.recuLe, fin: saisie.fin, reduit: saisie.reduit } };
}

/** Une retenue sur le dépôt, telle qu'elle est tapée. */
export interface SaisieRetenue {
  readonly motif: string;
  readonly montant: string;
}

export interface SaisieRestitution {
  readonly clesLe: string;
  readonly conforme: boolean;
  readonly retenues: readonly SaisieRetenue[];
}

export type ChampRestitution = 'clesLe' | 'retenues';

export type LectureRestitution =
  | { readonly ok: true; readonly restitution: RestitutionSaisie }
  | { readonly ok: false; readonly erreurs: readonly ChampRestitution[] };

export const RETENUE_VIDE: SaisieRetenue = { motif: '', montant: '' };

/** Le formulaire ouvert : clés remises à la sortie, état des lieux conforme. */
export function saisieRestitutionInitiale(sortie: string, aujourdhui: string): SaisieRestitution {
  return {
    clesLe: sortie > aujourdhui ? aujourdhui : sortie,
    conforme: true,
    retenues: [RETENUE_VIDE],
  };
}

export function lireRestitution(saisie: SaisieRestitution): LectureRestitution {
  const erreurs: ChampRestitution[] = [];
  if (!JourSchema.safeParse(saisie.clesLe).success) erreurs.push('clesLe');
  const remplies = saisie.retenues.filter((r) => r.motif.trim() !== '' || r.montant.trim() !== '');
  const retenues = remplies.map((r) => ({
    motif: r.motif.trim().slice(0, MOTIF_RETENUE_MAX),
    montant: centimesDepuisTexte(r.montant) ?? 0,
  }));
  const invalides = retenues.some((r) => r.motif === '' || r.montant === 0);
  if (!saisie.conforme && (retenues.length === 0 || invalides || retenues.length > RETENUES_MAX)) {
    erreurs.push('retenues');
  }
  if (erreurs.length > 0) return { ok: false, erreurs };
  return {
    ok: true,
    restitution: {
      clesLe: saisie.clesLe,
      conforme: saisie.conforme,
      retenues: saisie.conforme ? [] : retenues,
    },
  };
}

/** Le formulaire « Changer de colocataire » : qui part, qui arrive. */
export interface SaisieColocataire {
  /** L'identifiant du locataire qui part, ou vide : personne ne part. */
  readonly sortantId: string;
  readonly dateDepart: string;
  /** « Prénom Nom » du nouveau colocataire ; vide : personne n'arrive. */
  readonly arrivant: string;
  readonly email: string;
  readonly dateArrivee: string;
}

export type ChampColocataire = 'sortantId' | 'dateDepart' | 'arrivant' | 'dateArrivee';

export type LectureColocataire =
  | { readonly ok: true; readonly changement: ChangementColocataire }
  | { readonly ok: false; readonly erreurs: readonly ChampColocataire[] };

export const SANS_SORTANT = '';

export function saisieColocataireInitiale(aujourdhui: string): SaisieColocataire {
  return {
    sortantId: SANS_SORTANT,
    dateDepart: aujourdhui,
    arrivant: '',
    email: '',
    dateArrivee: aujourdhui,
  };
}

/** Le changement à envoyer : un départ, une arrivée, ou les deux ; au moins l'un des deux. */
export function lireColocataire(saisie: SaisieColocataire): LectureColocataire {
  const erreurs: ChampColocataire[] = [];
  const part = saisie.sortantId !== SANS_SORTANT;
  const arrive = saisie.arrivant.trim() !== '';
  if (!part && !arrive) erreurs.push('sortantId');
  if (part && !JourSchema.safeParse(saisie.dateDepart).success) erreurs.push('dateDepart');
  const nom = arrive ? decouperNom(saisie.arrivant) : null;
  if (arrive && nom === null) erreurs.push('arrivant');
  if (arrive && !JourSchema.safeParse(saisie.dateArrivee).success) erreurs.push('dateArrivee');
  if (erreurs.length > 0) return { ok: false, erreurs };
  const email = saisie.email.trim();
  const locataire: NouveauLocataire | null =
    nom === null ? null : { ...nom, ...(email === '' ? {} : { email }) };
  return {
    ok: true,
    changement: {
      ...(part ? { depart: { locataireId: saisie.sortantId, date: saisie.dateDepart } } : {}),
      ...(locataire === null ? {} : { arrivee: { locataire, date: saisie.dateArrivee } }),
    },
  };
}
