import { z } from 'zod';

import { refusFin, type RefusFin } from './baux';
import { joursDansMois, JourSchema } from './dates';
import type { TypeLocation } from './regles';
import type { FormeBail } from './regles-bail';
import { PREAVIS_LOCATAIRE } from './regles-fin-bail';
import type { LocationGeree, Paiement } from './schemas';

/*
 * Le congé donné par le locataire et son préavis (loi n° 89-462, art. 15 et 25-8) : Deklic calcule la
 * date de fin, le bailleur peut la changer ; la sortie reste la colonne `fin` de la location (ADR-G35).
 */

const IdentifiantSchema = z.string().min(1).max(100);
const HorodatageSchema = z.string().min(1).max(40);

function deuxChiffres(n: number): string {
  return String(n).padStart(2, '0');
}

/** « 2026-09-05 » + 3 → « 2026-12-05 » ; « 2027-01-31 » + 1 → « 2027-02-28 » (même quantième, sinon fin de mois). */
export function ajouterMoisAuJour(jour: string, nombre: number): string {
  const rang = Number(jour.slice(0, 4)) * 12 + Number(jour.slice(5, 7)) - 1 + nombre;
  const annee = Math.floor(rang / 12);
  const mois = (rang % 12) + 1;
  const quantieme = Math.min(Number(jour.slice(8, 10)), joursDansMois(annee, mois));
  return `${String(annee)}-${deuxChiffres(mois)}-${deuxChiffres(quantieme)}`;
}

/** Pourquoi le préavis a cette durée : chaque cas a sa phrase et sa source à l'écran. */
export type RaisonPreavis =
  'nue' | 'zone_inconnue' | 'zone_tendue' | 'motif_reduit' | 'meublee' | 'mobilite';

export interface ContextePreavis {
  readonly type: TypeLocation;
  readonly formeBail: FormeBail;
  /** Saisie de la vie du bail (B1) ; `null` = inconnue. */
  readonly zoneTendue: boolean | null;
  /** Le locataire invoque un motif de préavis réduit (mutation, premier emploi, santé, RSA…). */
  readonly reduit: boolean;
}

export interface Preavis {
  readonly mois: number;
  readonly raison: RaisonPreavis;
}

/** La durée du préavis du locataire ; une zone tendue inconnue donne le préavis le plus long, dit comme tel. */
export function preavisLocataire(c: ContextePreavis): Preavis {
  if (c.formeBail === 'mobilite') return { mois: PREAVIS_LOCATAIRE.mobilite, raison: 'mobilite' };
  if (c.type === 'meublee' || c.formeBail === 'etudiant') {
    return { mois: PREAVIS_LOCATAIRE.meublee, raison: 'meublee' };
  }
  if (c.zoneTendue === true) return { mois: PREAVIS_LOCATAIRE.reduit, raison: 'zone_tendue' };
  if (c.reduit) return { mois: PREAVIS_LOCATAIRE.reduit, raison: 'motif_reduit' };
  return { mois: PREAVIS_LOCATAIRE.nue, raison: c.zoneTendue === null ? 'zone_inconnue' : 'nue' };
}

/** Un motif de préavis réduit change-t-il quelque chose ? Seulement en location vide hors zone tendue. */
export function motifReduitUtile(c: Omit<ContextePreavis, 'reduit'>): boolean {
  return preavisLocataire({ ...c, reduit: false }).mois > PREAVIS_LOCATAIRE.reduit;
}

/** La date de fin du préavis : dernier jour dû par le locataire. */
export function finDePreavis(recuLe: string, c: ContextePreavis): string {
  return ajouterMoisAuJour(recuLe, preavisLocataire(c).mois);
}

const champsConge = {
  /** Jour de réception de la lettre, de l'acte ou de la remise en main propre. */
  recuLe: JourSchema,
  /** La sortie retenue : la fin du préavis, ou la date choisie par le bailleur. */
  fin: JourSchema,
  reduit: z.boolean(),
};

const FIN_APRES_RECEPTION = {
  message: 'La fin ne peut pas précéder la réception du congé',
  path: ['fin'],
};

export const CongeSaisieSchema = z
  .object(champsConge)
  .refine((c) => c.fin >= c.recuLe, FIN_APRES_RECEPTION);

export const CongeSchema = z
  .object({ locationId: IdentifiantSchema, ...champsConge, modifieLe: HorodatageSchema })
  .refine((c) => c.fin >= c.recuLe, FIN_APRES_RECEPTION);

export type CongeSaisie = z.infer<typeof CongeSaisieSchema>;
export type Conge = z.infer<typeof CongeSchema>;

export type RefusConge = RefusFin | 'DATE_INVALIDE' | 'CONGE_INVALIDE';

/**
 * Pourquoi ce congé est refusé, ou `null` : reçu dans le futur, reçu avant l'entrée, puis les refus de
 * toute sortie (avant l'entrée, loyers déjà reçus pour un mois qui suit).
 */
export function refusConge(
  location: Pick<LocationGeree, 'id' | 'debut'>,
  saisie: CongeSaisie,
  paiements: readonly Paiement[],
  aujourdhui: string,
): RefusConge | null {
  if (saisie.recuLe > aujourdhui) return 'DATE_INVALIDE';
  if (saisie.recuLe < location.debut) return 'CONGE_INVALIDE';
  return refusFin(location, saisie.fin, paiements);
}

export type StatutLocation = 'a_venir' | 'active' | 'preavis' | 'terminee';

/** Où en est une location : jamais stocké (ADR-G35). Un congé sans sortie à venir ne fait pas de préavis. */
export function statutLocation(
  location: Pick<LocationGeree, 'debut' | 'fin'>,
  aUnConge: boolean,
  aujourdhui: string,
): StatutLocation {
  if (location.fin !== undefined && location.fin < aujourdhui) return 'terminee';
  if (location.debut > aujourdhui) return 'a_venir';
  return aUnConge && location.fin !== undefined ? 'preavis' : 'active';
}
