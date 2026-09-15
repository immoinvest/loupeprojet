import { z } from 'zod';

import { JourSchema, PeriodeSchema } from './dates';
import { RetenueSchema, totalRetenues, type Retenue } from './depot-garantie';
import { CategorieDepenseSchema } from './depenses';
import { IdentiteBailleurSchema, type IdentiteBailleur } from './documents';
import { COLOCATAIRES_MAX } from './regles';
import { RETENUES_MAX } from './regles-fin-bail';
import { AnneeSchema, SoldeSchema, type DecompteCharges } from './regularisation';
import { CentimesSchema, type LocationGeree } from './schemas';

/*
 * Décomptes de fin de bail : restitution du dépôt de garantie et régularisation des charges. Contenu
 * complet, figé à l'émission (ADR-G8), rangé dans sa propre table (ADR-G39).
 */

const IdentifiantSchema = z.string().min(1).max(100);
const texte = (max: number): z.ZodString => z.string().trim().min(1).max(max);

const champsCommuns = {
  numero: z.string().min(1).max(40),
  emisLe: JourSchema,
  bailleur: IdentiteBailleurSchema,
  locataires: z
    .array(z.object({ prenom: texte(80), nom: texte(80) }))
    .min(1)
    .max(1 + COLOCATAIRES_MAX),
  logement: z.object({ nom: texte(80), adresse: texte(200), libelle: texte(40).optional() }),
};

export const ContenuRestitutionSchema = z.object({
  type: z.literal('restitution'),
  ...champsCommuns,
  entree: JourSchema,
  sortie: JourSchema,
  clesLe: JourSchema,
  conforme: z.boolean(),
  depot: CentimesSchema,
  retenues: z.array(RetenueSchema).max(RETENUES_MAX),
  totalRetenues: CentimesSchema,
  aRendre: CentimesSchema,
  dateLimite: JourSchema,
});

export const ContenuRegularisationSchema = z.object({
  type: z.literal('regularisation'),
  ...champsCommuns,
  annee: AnneeSchema,
  debut: JourSchema,
  fin: JourSchema,
  provisions: CentimesSchema,
  charges: z.array(z.object({ categorie: CategorieDepenseSchema, montant: CentimesSchema })),
  totalCharges: CentimesSchema,
  joursOccupes: z.number().int().min(1).max(366),
  joursAnnee: z.number().int().min(365).max(366),
  chambres: z.number().int().min(1),
  solde: SoldeSchema,
  aPartirDe: PeriodeSchema,
});

export const ContenuDecompteSchema = z.discriminatedUnion('type', [
  ContenuRestitutionSchema,
  ContenuRegularisationSchema,
]);

export const TYPES_DECOMPTE = ['restitution', 'regularisation'] as const;
export type TypeDecompte = (typeof TYPES_DECOMPTE)[number];

const champsDecompte = {
  id: IdentifiantSchema,
  type: z.enum(TYPES_DECOMPTE),
  locationId: IdentifiantSchema,
  numero: z.string().min(1).max(40),
  /** Horodatage ISO de l'émission. */
  emisLe: z.string().min(1).max(40),
};

/** Ce que l'état liste : le décompte sans son contenu. */
export const DecompteSchema = z.object(champsDecompte);
export const DecompteCompletSchema = z.object({
  ...champsDecompte,
  contenu: ContenuDecompteSchema,
});

export type ContenuRestitution = z.infer<typeof ContenuRestitutionSchema>;
export type ContenuRegularisation = z.infer<typeof ContenuRegularisationSchema>;
export type ContenuDecompte = z.infer<typeof ContenuDecompteSchema>;
export type Decompte = z.infer<typeof DecompteSchema>;
export type DecompteComplet = z.infer<typeof DecompteCompletSchema>;

/** Un décompte de restitution par location (ADR-G39). */
export function cleRestitution(locationId: string): string {
  return `restitution:${locationId}`;
}

/** Un décompte de régularisation par location et par année. */
export function cleRegularisation(locationId: string, annee: number): string {
  return `regularisation:${locationId}:${String(annee)}`;
}

function court(identifiant: string): string {
  return identifiant
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 8)
    .toUpperCase();
}

/** « D-202604-3F9A2C1B » (dépôt, mois des clés) ; « C-2026-3F9A2C1B » (charges, année). */
export function numeroDecompte(type: TypeDecompte, repere: string, locationId: string): string {
  const prefixe = type === 'restitution' ? 'D' : 'C';
  return `${prefixe}-${repere.replace('-', '')}-${court(locationId)}`;
}

/** Qui, où : repris des données de gestion au moment de l'émission. */
export interface IdentitesDecompte {
  readonly bailleur: IdentiteBailleur;
  readonly locataires: readonly { readonly prenom: string; readonly nom: string }[];
  readonly logement: { readonly nom: string; readonly adresse: string; readonly libelle?: string };
  readonly emisLe: string;
}

export interface RestitutionAEmettre {
  readonly clesLe: string;
  readonly conforme: boolean;
  readonly retenues: readonly Retenue[];
  readonly dateLimite: string;
}

/** Le décompte de restitution du dépôt, validé. */
export function contenuRestitution(
  identites: IdentitesDecompte,
  location: Pick<LocationGeree, 'id' | 'debut' | 'fin' | 'depot'>,
  restitution: RestitutionAEmettre,
): ContenuRestitution {
  const retenu = totalRetenues(restitution.retenues);
  return ContenuRestitutionSchema.parse({
    type: 'restitution',
    numero: numeroDecompte('restitution', restitution.clesLe.slice(0, 7), location.id),
    ...identites,
    entree: location.debut,
    sortie: location.fin ?? restitution.clesLe,
    clesLe: restitution.clesLe,
    conforme: restitution.conforme,
    depot: location.depot,
    retenues: restitution.retenues,
    totalRetenues: retenu,
    aRendre: Math.max(0, location.depot - retenu),
    dateLimite: restitution.dateLimite,
  });
}

/** Le décompte de régularisation des charges d'une année, validé. */
export function contenuRegularisation(
  identites: IdentitesDecompte,
  locationId: string,
  decompte: DecompteCharges,
  aPartirDe: string,
): ContenuRegularisation {
  return ContenuRegularisationSchema.parse({
    type: 'regularisation',
    numero: numeroDecompte('regularisation', String(decompte.annee), locationId),
    ...identites,
    annee: decompte.annee,
    debut: decompte.debut,
    fin: decompte.fin,
    provisions: decompte.provisions,
    charges: decompte.charges,
    totalCharges: decompte.totalCharges,
    joursOccupes: decompte.joursOccupes,
    joursAnnee: decompte.joursAnnee,
    chambres: decompte.chambres,
    solde: decompte.solde,
    aPartirDe,
  });
}
