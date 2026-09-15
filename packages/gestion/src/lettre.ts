import { z } from 'zod';

import { JourSchema, PeriodeSchema } from './dates';
import {
  LegalBienSchema,
  RevisionLocationSchema,
  TrimestreSchema,
  type PropositionProposee,
} from './bail';
import { IdentiteBailleurSchema, type IdentiteBailleur } from './documents';
import { COLOCATAIRES_MAX } from './regles';
import { CentimesSchema, LocationGereeSchema } from './schemas';

/*
 * La lettre de révision du loyer : contenu complet, figé à l'émission comme une quittance (ADR-G8),
 * rangé dans sa propre table (ADR-G24) pour ne rien changer aux documents que `/etat` relit.
 */

const IdentifiantSchema = z.string().min(1).max(100);
const texte = (max: number): z.ZodString => z.string().trim().min(1).max(max);
const IndiceSchema = z.object({ trimestre: TrimestreSchema, valeur: z.number().int().positive() });

export const ContenuLettreRevisionSchema = z.object({
  numero: z.string().min(1).max(40),
  emisLe: JourSchema,
  bailleur: IdentiteBailleurSchema,
  locataires: z
    .array(z.object({ prenom: texte(80), nom: texte(80) }))
    .min(1)
    .max(1 + COLOCATAIRES_MAX),
  logement: z.object({ nom: texte(80), adresse: texte(200), libelle: texte(40).optional() }),
  anniversaire: JourSchema,
  aPartirDe: PeriodeSchema,
  loyerActuel: CentimesSchema,
  nouveauLoyer: CentimesSchema,
  charges: CentimesSchema,
  indiceAncien: IndiceSchema,
  indiceNouveau: IndiceSchema.extend({ publieLe: JourSchema }),
  variationPourcent: z.number().min(0).max(100),
});

const champsLettre = {
  id: IdentifiantSchema,
  locationId: IdentifiantSchema,
  numero: z.string().min(1).max(40),
  anniversaire: JourSchema,
  /** Horodatage ISO de l'émission. */
  emisLe: z.string().min(1).max(40),
};

export const LettreRevisionSchema = z.object(champsLettre);
export const LettreRevisionCompleteSchema = z.object({
  ...champsLettre,
  contenu: ContenuLettreRevisionSchema,
});

/** Tout ce que `/api/gestion/bail` rend pour un compte. */
export const EtatBailSchema = z.object({
  biens: z.array(LegalBienSchema),
  revisions: z.array(RevisionLocationSchema),
  lettres: z.array(LettreRevisionSchema),
});

/** La réponse d'« Appliquer la révision ». */
export const RevisionAppliqueeSchema = z.object({
  lettre: LettreRevisionCompleteSchema,
  revision: RevisionLocationSchema,
  location: LocationGereeSchema,
});

export type ContenuLettreRevision = z.infer<typeof ContenuLettreRevisionSchema>;
export type LettreRevision = z.infer<typeof LettreRevisionSchema>;
export type LettreRevisionComplete = z.infer<typeof LettreRevisionCompleteSchema>;
export type EtatBail = z.infer<typeof EtatBailSchema>;
export type RevisionAppliquee = z.infer<typeof RevisionAppliqueeSchema>;

/** Une lettre par location et par anniversaire (idempotence d'« Appliquer »). */
export function cleLettre(locationId: string, anniversaire: string): string {
  return `revision:${locationId}:${anniversaire}`;
}

/** « V-202610-3F9A2C1B » : mois d'effet et début de l'identifiant de la location. */
export function numeroLettre(aPartirDe: string, locationId: string): string {
  const court = locationId
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 8)
    .toUpperCase();
  return `V-${aPartirDe.replace('-', '')}-${court}`;
}

export interface EntreesLettre {
  readonly locationId: string;
  readonly bailleur: IdentiteBailleur;
  readonly locataires: readonly { readonly prenom: string; readonly nom: string }[];
  readonly logement: { readonly nom: string; readonly adresse: string; readonly libelle?: string };
  readonly proposition: PropositionProposee;
  /** Jour d'émission. */
  readonly emisLe: string;
}

/** Le contenu figé de la lettre, validé. */
export function contenuLettreRevision(entrees: EntreesLettre): ContenuLettreRevision {
  const { proposition: p } = entrees;
  return ContenuLettreRevisionSchema.parse({
    numero: numeroLettre(p.aPartirDe, entrees.locationId),
    emisLe: entrees.emisLe,
    bailleur: entrees.bailleur,
    locataires: entrees.locataires,
    logement: entrees.logement,
    anniversaire: p.anniversaire,
    aPartirDe: p.aPartirDe,
    loyerActuel: p.loyerActuel,
    nouveauLoyer: p.nouveauLoyer,
    charges: p.charges,
    indiceAncien: p.indiceAncien,
    indiceNouveau: p.indiceNouveau,
    variationPourcent: p.variationPourcent,
  });
}
