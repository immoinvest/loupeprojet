import { z } from 'zod';

import { ajouterJours, JourSchema, periodeDe, periodeSuivante } from './dates';
import { montantsDuMois, premierMoisModifiable } from './montants';
import {
  CLASSES_DPE,
  FORMES_BAIL,
  GEL_LOYERS,
  IRL,
  JOUR_PUBLICATION_ESTIME,
  MOIS_PUBLICATION_IRL,
  PREVENANCE_REVISION_JOURS,
  type ClasseDpe,
} from './regles-bail';
import type { LocationGeree, Paiement } from './schemas';

/*
 * Révision annuelle du loyer (loi n° 89-462 du 6 juillet 1989, art. 17-1) : à l'anniversaire, le loyer
 * hors charges suit au plus la variation de l'IRL du trimestre de référence ; la révision vaut à la date
 * de la demande, jamais avant (ADR-G25, G26). Les caractéristiques légales du bien et les réglages de
 * révision vivent dans des tables latérales (ADR-G24).
 */

const IdentifiantSchema = z.string().min(1).max(100);
const HorodatageSchema = z.string().min(1).max(40);

export const ClasseDpeSchema = z.enum(CLASSES_DPE);
export const FormeBailSchema = z.enum(FORMES_BAIL);
export const TrimestreSchema = z
  .string()
  .regex(/^\d{4}-T[1-4]$/, { message: 'Trimestre invalide (AAAA-Tn)' });

/** Ce que le bailleur enregistre pour un bien : `null` = inconnu. */
export const LegalBienSaisieSchema = z.object({
  dpeClasse: ClasseDpeSchema.nullable(),
  dpeDate: JourSchema.nullable(),
  zoneTendue: z.boolean().nullable(),
});
export const LegalBienSchema = LegalBienSaisieSchema.extend({
  bienId: IdentifiantSchema,
  modifieLe: HorodatageSchema,
});

/** Les réglages de révision d'une location. */
export const RevisionSaisieSchema = z.object({
  active: z.boolean(),
  /** La date dont chaque anniversaire déclenche une révision (souvent l'entrée). */
  anniversaire: JourSchema,
  /** Le trimestre de l'IRL de référence ; son année est la plus ancienne comparée. */
  trimestre: TrimestreSchema,
  formeBail: FormeBailSchema,
});
export const RevisionLocationSchema = RevisionSaisieSchema.extend({
  locationId: IdentifiantSchema,
  /** L'anniversaire de la dernière révision appliquée dans Deklic. */
  derniereRevision: JourSchema.nullable(),
  modifieLe: HorodatageSchema,
});

/** « Appliquer la révision » : l'anniversaire vu par le navigateur ; le serveur recalcule tout le reste. */
export const DemandeRevisionSchema = z.object({ anniversaire: JourSchema });

export type LegalBienSaisie = z.infer<typeof LegalBienSaisieSchema>;
export type LegalBien = z.infer<typeof LegalBienSchema>;
export type RevisionSaisie = z.infer<typeof RevisionSaisieSchema>;
export type RevisionLocation = z.infer<typeof RevisionLocationSchema>;
export type DemandeRevision = z.infer<typeof DemandeRevisionSchema>;

type NumeroTrimestre = 1 | 2 | 3 | 4;

function lireTrimestre(trimestre: string): { annee: number; numero: NumeroTrimestre } {
  return {
    annee: Number(trimestre.slice(0, 4)),
    numero: Number(trimestre.slice(6, 7)) as NumeroTrimestre,
  };
}

export function trimestreDe(annee: number, numero: NumeroTrimestre): string {
  return `${String(annee)}-T${String(numero)}`;
}

/** « 2026-10-01 » + 1 → « 2027-10-01 » ; un 29 février devient le 28 d'une année non bissextile. */
export function ajouterAnnees(jour: string, nombre: number): string {
  const annee = String(Number(jour.slice(0, 4)) + nombre);
  const mmjj = jour.slice(5);
  const valide = JourSchema.safeParse(`${annee}-${mmjj}`).success;
  return `${annee}-${valide ? mmjj : '02-28'}`;
}

export interface PublicationIrl {
  /** Jour de publication réel, ou estimé si l'indice n'est pas encore connu de Deklic. */
  readonly date: string;
  /** L'indice en centièmes, ou `null` s'il n'est pas dans le tableau. */
  readonly valeur: number | null;
}

/** La publication d'un trimestre : celle du tableau, sinon le 15 du mois habituel. */
export function publicationIrl(trimestre: string): PublicationIrl {
  const connu = IRL.find((v) => v.trimestre === trimestre);
  if (connu !== undefined) return { date: connu.publieLe, valeur: connu.valeur };
  const { annee, numero } = lireTrimestre(trimestre);
  const anneePublication = numero === 4 ? annee + 1 : annee;
  const mois = String(MOIS_PUBLICATION_IRL[numero]).padStart(2, '0');
  return {
    date: `${String(anneePublication)}-${mois}-${String(JOUR_PUBLICATION_ESTIME)}`,
    valeur: null,
  };
}

const NUMEROS: readonly NumeroTrimestre[] = [1, 2, 3, 4];

/** Le dernier trimestre publié (ou dont la publication est estimée) au plus tard ce jour. */
export function trimestrePublieA(jour: string): string {
  const annee = Number(jour.slice(0, 4));
  let retenu = trimestreDe(annee - 2, 4);
  for (const a of [annee - 1, annee]) {
    for (const numero of NUMEROS) {
      const trimestre = trimestreDe(a, numero);
      if (publicationIrl(trimestre).date <= jour) retenu = trimestre;
    }
  }
  return retenu;
}

/** L'année du dernier indice de ce numéro de trimestre publié au plus tard ce jour. */
function anneeIndice(numero: NumeroTrimestre, jour: string): number {
  const annee = Number(jour.slice(0, 4));
  return (
    [annee, annee - 1].find((a) => publicationIrl(trimestreDe(a, numero)).date <= jour) ?? annee - 2
  );
}

/** L'anniversaire le plus récent dont la révision est déjà proposée (un mois avant), ou `null`. */
export function anniversaireCourant(anniversaire: string, aujourdhui: string): string | null {
  const ecart = Number(aujourdhui.slice(0, 4)) - Number(anniversaire.slice(0, 4)) + 1;
  for (let rang = ecart; rang >= 1; rang -= 1) {
    const date = ajouterAnnees(anniversaire, rang);
    if (ajouterJours(date, -PREVENANCE_REVISION_JOURS) <= aujourdhui) return date;
  }
  return null;
}

/**
 * Les réglages proposés tant que le bailleur n'a rien enregistré (ADR-G28) : révision active à
 * l'anniversaire de l'entrée, référence = trimestre du dernier IRL publié à l'entrée, en supposant les
 * révisions précédentes faites chaque année.
 */
export function revisionParDefaut(
  location: Pick<LocationGeree, 'debut'>,
  aujourdhui: string,
): RevisionSaisie {
  const reference = trimestrePublieA(location.debut);
  const { numero } = lireTrimestre(reference);
  const courant = anniversaireCourant(location.debut, aujourdhui);
  const precedent = courant === null ? null : ajouterAnnees(courant, -1);
  const trimestre =
    precedent === null || precedent <= location.debut
      ? reference
      : trimestreDe(anneeIndice(numero, precedent), numero);
  return { active: true, anniversaire: location.debut, trimestre, formeBail: 'classique' };
}

/** Le premier mois qui commence au plus tôt à la demande et à l'anniversaire, après le dernier mois payé. */
export function moisDEffet(
  anniversaire: string,
  jourDemande: string,
  location: Pick<LocationGeree, 'id' | 'debut' | 'fin'>,
  paiements: readonly Paiement[],
): string {
  const jour = jourDemande > anniversaire ? jourDemande : anniversaire;
  const mois = jour.endsWith('-01') ? periodeDe(jour) : periodeSuivante(periodeDe(jour));
  const modifiable = premierMoisModifiable(location, paiements);
  return mois > modifiable ? mois : modifiable;
}

export interface Indice {
  readonly trimestre: string;
  readonly valeur: number;
}

export type PropositionRevision =
  | { readonly statut: 'inactive' }
  | { readonly statut: 'terminee' }
  | { readonly statut: 'pas_encore'; readonly prochaine: string }
  | { readonly statut: 'appliquee'; readonly anniversaire: string; readonly prochaine: string }
  | { readonly statut: 'gelee'; readonly anniversaire: string; readonly classe: ClasseDpe }
  | {
      readonly statut: 'indice_attendu';
      readonly anniversaire: string;
      readonly trimestre: string;
      readonly publicationPrevue: string;
    }
  | { readonly statut: 'reference_inconnue'; readonly anniversaire: string }
  | { readonly statut: 'sans_hausse'; readonly anniversaire: string; readonly aPartirDe: string }
  | PropositionProposee;

export interface PropositionProposee {
  readonly statut: 'proposee';
  readonly anniversaire: string;
  /** Premier mois au nouveau loyer. */
  readonly aPartirDe: string;
  readonly loyerActuel: number;
  readonly nouveauLoyer: number;
  readonly charges: number;
  readonly indiceAncien: Indice;
  readonly indiceNouveau: Indice & { readonly publieLe: string };
  /** Variation de l'indice en pour cent, arrondie au centième : 1,15. */
  readonly variationPourcent: number;
}

export interface EntreesRevision {
  readonly location: Pick<
    LocationGeree,
    'id' | 'debut' | 'fin' | 'loyerHorsCharges' | 'charges' | 'apl' | 'changements'
  >;
  readonly paiements: readonly Paiement[];
  readonly revision: RevisionSaisie & { readonly derniereRevision: string | null };
  readonly classeDpe: ClasseDpe | null;
  readonly aujourdhui: string;
}

/** Où en est la révision d'une location aujourd'hui, et le nouveau loyer quand elle est proposée. */
export function propositionRevision(entrees: EntreesRevision): PropositionRevision {
  const { location, paiements, revision, classeDpe, aujourdhui } = entrees;
  if (!revision.active) return { statut: 'inactive' };
  const anniversaire = anniversaireCourant(revision.anniversaire, aujourdhui);
  if (anniversaire === null) {
    return { statut: 'pas_encore', prochaine: ajouterAnnees(revision.anniversaire, 1) };
  }
  if (location.fin !== undefined && location.fin < anniversaire) return { statut: 'terminee' };
  const prochaine = ajouterAnnees(anniversaire, 1);
  if (revision.derniereRevision !== null && revision.derniereRevision >= anniversaire) {
    return { statut: 'appliquee', anniversaire, prochaine };
  }
  if (classeDpe !== null && GEL_LOYERS.classes.includes(classeDpe)) {
    return { statut: 'gelee', anniversaire, classe: classeDpe };
  }

  const { annee: anneeReference, numero } = lireTrimestre(revision.trimestre);
  const annee = anneeIndice(numero, anniversaire);
  if (annee - 1 < anneeReference) return { statut: 'pas_encore', prochaine };
  const trimestre = trimestreDe(annee, numero);
  const nouveau = publicationIrl(trimestre);
  if (nouveau.valeur === null) {
    return { statut: 'indice_attendu', anniversaire, trimestre, publicationPrevue: nouveau.date };
  }
  const trimestreAncien = trimestreDe(annee - 1, numero);
  const ancien = publicationIrl(trimestreAncien).valeur;
  if (ancien === null) return { statut: 'reference_inconnue', anniversaire };

  const aPartirDe = moisDEffet(anniversaire, aujourdhui, location, paiements);
  const { loyerHorsCharges, charges } = montantsDuMois(location, aPartirDe);
  const nouveauLoyer = Math.round((loyerHorsCharges * nouveau.valeur) / ancien);
  if (nouveauLoyer <= loyerHorsCharges) return { statut: 'sans_hausse', anniversaire, aPartirDe };
  return {
    statut: 'proposee',
    anniversaire,
    aPartirDe,
    loyerActuel: loyerHorsCharges,
    nouveauLoyer,
    charges,
    indiceAncien: { trimestre: trimestreAncien, valeur: ancien },
    indiceNouveau: { trimestre, valeur: nouveau.valeur, publieLe: nouveau.date },
    variationPourcent: Math.round(((nouveau.valeur - ancien) * 10_000) / ancien) / 100,
  };
}
