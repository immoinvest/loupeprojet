import { z } from 'zod';

import { occurrenceDuMois } from './argent';
import { joursDansMois, JourSchema, periodeDe, periodeSuivante, PeriodeSchema } from './dates';
import type { Depense } from './depenses';
import { ajouterMoisAuJour } from './fin-bail';
import { loyerDuMois } from './loyers';
import { MONTANT_MAX_CENTIMES } from './regles';
import { CATEGORIES_DEPENSE, type CategorieDepense } from './regles-argent';
import { MODES_CHARGES, REGULARISATION_CHARGES } from './regles-fin-bail';
import type { LocationGeree } from './schemas';

/*
 * Régularisation annuelle des charges (loi n° 89-462, art. 23) : provisions dues de l'année contre les
 * dépenses récupérables du bien (A1), au prorata du temps d'occupation ; l'échéance vit à part des loyers
 * du mois (ADR-G37).
 */

const IdentifiantSchema = z.string().min(1).max(100);
const HorodatageSchema = z.string().min(1).max(40);
export const AnneeSchema = z.number().int().min(2000).max(2100);

export const ModeChargesSchema = z.enum(MODES_CHARGES);
export const ModeChargesSaisieSchema = z.object({ mode: ModeChargesSchema });
export const ModeChargesLocationSchema = z.object({
  locationId: IdentifiantSchema,
  mode: ModeChargesSchema,
  modifieLe: HorodatageSchema,
});

export const DemandeRegularisationSchema = z.object({ annee: AnneeSchema });
export const RegleeSchema = z.object({ regleeLe: JourSchema });

/** Solde positif : complément dû par le locataire ; négatif : remboursement par le bailleur. */
export const SoldeSchema = z.number().int().min(-MONTANT_MAX_CENTIMES).max(MONTANT_MAX_CENTIMES);

export const RegularisationSchema = z.object({
  id: IdentifiantSchema,
  locationId: IdentifiantSchema,
  annee: AnneeSchema,
  solde: SoldeSchema,
  /** Le mois où le complément ou le remboursement est dû. */
  aPartirDe: PeriodeSchema,
  decompteId: IdentifiantSchema,
  regleeLe: JourSchema.nullable(),
  creeLe: HorodatageSchema,
});

export type ModeChargesLocation = z.infer<typeof ModeChargesLocationSchema>;
export type Regularisation = z.infer<typeof RegularisationSchema>;

export interface ChargeParNature {
  readonly categorie: CategorieDepense;
  readonly montant: number;
}

export interface DecompteCharges {
  readonly statut: 'proposee';
  readonly annee: number;
  /** Jours de l'année couverts par la location. */
  readonly debut: string;
  readonly fin: string;
  readonly provisions: number;
  /** Quote-part de la location, par nature, dans l'ordre des catégories. */
  readonly charges: readonly ChargeParNature[];
  readonly totalCharges: number;
  readonly joursOccupes: number;
  readonly joursAnnee: number;
  /** Chambres louées sur le bien dans l'année (1 pour un bien loué en entier). */
  readonly chambres: number;
  readonly solde: number;
}

export type PropositionRegularisation =
  | { readonly statut: 'forfait' }
  | { readonly statut: 'hors_location' }
  | { readonly statut: 'sans_depenses'; readonly provisions: number }
  | DecompteCharges;

type Occupation = Pick<
  LocationGeree,
  | 'id'
  | 'bienId'
  | 'debut'
  | 'fin'
  | 'jourLoyer'
  | 'loyerHorsCharges'
  | 'charges'
  | 'apl'
  | 'changements'
>;

export interface EntreesRegularisation {
  readonly location: Occupation;
  /** Toutes les locations du bien (celle-ci comprise), pour compter les chambres louées. */
  readonly locationsDuBien: readonly Pick<LocationGeree, 'debut' | 'fin' | 'libelle'>[];
  readonly depenses: readonly Pick<
    Depense,
    'bienId' | 'categorie' | 'montant' | 'date' | 'recurrence' | 'recuperable'
  >[];
  readonly annee: number;
  readonly mode: (typeof MODES_CHARGES)[number];
}

function moisDeLAnnee(annee: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${String(annee)}-${String(i + 1).padStart(2, '0')}`);
}

function occupeLAnnee(l: Pick<LocationGeree, 'debut' | 'fin'>, annee: number): boolean {
  return (
    l.debut <= `${String(annee)}-12-31` &&
    (l.fin === undefined || l.fin >= `${String(annee)}-01-01`)
  );
}

/** Les chambres louées sur le bien dans l'année : libellés distincts (sans libellé = le bien entier). */
function chambresDeLAnnee(
  locations: EntreesRegularisation['locationsDuBien'],
  annee: number,
): number {
  const libelles = new Set(
    locations
      .filter((l) => occupeLAnnee(l, annee))
      .map((l) => (l.libelle ?? '').toLocaleLowerCase('fr')),
  );
  return Math.max(1, libelles.size);
}

/** Le décompte proposé pour une année, ou pourquoi il n'y en a pas. */
export function regularisationDeLAnnee(e: EntreesRegularisation): PropositionRegularisation {
  if (e.mode === 'forfait') return { statut: 'forfait' };
  const mois = moisDeLAnnee(e.annee);
  let joursOccupes = 0;
  let provisions = 0;
  let debut: string | null = null;
  let fin = '';
  for (const periode of mois) {
    const du = loyerDuMois(e.location, periode);
    if (du === null) continue;
    joursOccupes += du.joursOccupes;
    provisions += du.charges;
    debut ??= du.debut;
    fin = du.fin;
  }
  if (debut === null) return { statut: 'hors_location' };

  const parNature = new Map<CategorieDepense, number>();
  for (const depense of e.depenses) {
    if (!depense.recuperable || depense.bienId !== e.location.bienId) continue;
    const occurrences = mois.filter((p) => occurrenceDuMois(depense, p) !== null).length;
    if (occurrences === 0) continue;
    parNature.set(
      depense.categorie,
      (parNature.get(depense.categorie) ?? 0) + depense.montant * occurrences,
    );
  }
  if (parNature.size === 0) return { statut: 'sans_depenses', provisions };

  const joursAnnee = joursDansMois(e.annee, 2) === 29 ? 366 : 365;
  const chambres = chambresDeLAnnee(e.locationsDuBien, e.annee);
  const charges = CATEGORIES_DEPENSE.flatMap((categorie): ChargeParNature[] => {
    const total = parNature.get(categorie);
    return total === undefined
      ? []
      : [{ categorie, montant: Math.round((total * joursOccupes) / (joursAnnee * chambres)) }];
  });
  const totalCharges = charges.reduce((somme, c) => somme + c.montant, 0);
  return {
    statut: 'proposee',
    annee: e.annee,
    debut,
    fin,
    provisions,
    charges,
    totalCharges,
    joursOccupes,
    joursAnnee,
    chambres,
    solde: totalCharges - provisions,
  };
}

/** Les années passées à régulariser : celles où la location a couru, trois au plus, la plus récente d'abord. */
export function anneesARegulariser(
  location: Pick<LocationGeree, 'debut' | 'fin'>,
  aujourdhui: string,
): number[] {
  const courante = Number(aujourdhui.slice(0, 4));
  const annees: number[] = [];
  for (
    let annee = courante - 1;
    annee >= courante - REGULARISATION_CHARGES.anneesProposees;
    annee -= 1
  ) {
    if (occupeLAnnee(location, annee)) annees.push(annee);
  }
  return annees;
}

/** Le premier mois qui commence au moins un mois après la validation (décompte un mois avant, art. 23). */
export function echeanceRegularisation(aujourdhui: string): string {
  const jour = ajouterMoisAuJour(aujourdhui, REGULARISATION_CHARGES.delaiDecompteMois);
  return jour.endsWith('-01') ? periodeDe(jour) : periodeSuivante(periodeDe(jour));
}
