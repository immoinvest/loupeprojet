import { z } from 'zod';

import { JourSchema, PeriodeSchema } from './dates';
import { COLOCATAIRES_MAX, MONTANT_MAX_CENTIMES } from './regles';

/*
 * Quittances et reçus (loi n° 89-462 du 6 juillet 1989, art. 21) : la quittance porte le détail
 * des sommes versées en distinguant le loyer et les charges ; un paiement partiel appelle un reçu.
 * Le contenu d'un document est une valeur complète, figée à l'émission (ADR-G8).
 */

const IdentifiantSchema = z.string().min(1).max(100);
const texte = (max: number): z.ZodString => z.string().trim().min(1).max(max);
const CentimesSchema = z.number().int().min(0).max(MONTANT_MAX_CENTIMES);

export const TYPES_DOCUMENT = ['quittance', 'recu'] as const;
export type TypeDocument = (typeof TYPES_DOCUMENT)[number];
export const TypeDocumentSchema = z.enum(TYPES_DOCUMENT);

/** Mentions en codes ; leurs phrases vivent côté web (`textes/gerer-documents.ts`). */
export const MENTIONS_DOCUMENT = [
  /** « Pour acquit » : le loyer du terme est entièrement réglé. */
  'pour_acquit',
  /** La quittance d'un mois d'abord payé en partie annule les reçus établis pour ce terme (modèle ANIL). */
  'annule_recus',
] as const;
export type MentionDocument = (typeof MENTIONS_DOCUMENT)[number];

/** Le nom et l'adresse du bailleur, tels qu'ils figurent sur le bail ; demandés une seule fois. */
export const IdentiteBailleurSchema = z.object({ nom: texte(120), adresse: texte(300) });

export const ContenuDocumentSchema = z.object({
  type: TypeDocumentSchema,
  numero: z.string().min(1).max(40),
  /** Jour d'émission. */
  emisLe: JourSchema,
  bailleur: IdentiteBailleurSchema,
  /** Tous les locataires du bail, le locataire en titre d'abord : la quittance d'une colocation les nomme tous. */
  locataires: z
    .array(z.object({ prenom: texte(80), nom: texte(80) }))
    .min(1)
    .max(1 + COLOCATAIRES_MAX),
  /** Le bien, et la chambre louée s'il y en a une. */
  logement: z.object({ nom: texte(80), adresse: texte(200), libelle: texte(40).optional() }),
  periode: PeriodeSchema,
  /** Jours couverts par le terme (au prorata d'une entrée ou d'une sortie). */
  debut: JourSchema,
  fin: JourSchema,
  loyerHorsCharges: CentimesSchema,
  charges: CentimesSchema,
  total: CentimesSchema,
  /** Quittance : tous les paiements du terme ; reçu : le paiement attesté. */
  paiements: z.array(z.object({ montant: CentimesSchema, date: JourSchema })).min(1),
  /** Montant attesté : total des paiements (quittance) ou montant du paiement (reçu). */
  montantRecu: CentimesSchema,
  /** Reçu : ce qui avait été reçu pour ce terme avant ce paiement ; quittance : 0. */
  dejaRecu: CentimesSchema,
  resteDu: CentimesSchema,
  mentions: z.array(z.enum(MENTIONS_DOCUMENT)),
});

const champsDocument = {
  id: IdentifiantSchema,
  type: TypeDocumentSchema,
  numero: z.string().min(1).max(40),
  locationId: IdentifiantSchema,
  periode: PeriodeSchema,
  /** Le paiement attesté (reçu seulement). */
  paiementId: IdentifiantSchema.optional(),
  /** Horodatage ISO de l'émission. */
  emisLe: z.string().min(1).max(40),
};

/** Ce que l'état du compte liste : le document sans son contenu. */
export const DocumentSchema = z.object(champsDocument);
export const DocumentCompletSchema = z.object({
  ...champsDocument,
  contenu: ContenuDocumentSchema,
});

export const DemandeDocumentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('quittance'), locationId: IdentifiantSchema, periode: PeriodeSchema }),
  z.object({ type: z.literal('recu'), paiementId: IdentifiantSchema }),
]);

export type IdentiteBailleur = z.infer<typeof IdentiteBailleurSchema>;
export type ContenuDocument = z.infer<typeof ContenuDocumentSchema>;
export type DocumentGestion = z.infer<typeof DocumentSchema>;
export type DocumentComplet = z.infer<typeof DocumentCompletSchema>;
export type DemandeDocument = z.infer<typeof DemandeDocumentSchema>;

/** La clé d'unicité d'un document dans un compte : une quittance par terme, un reçu par paiement (ADR-G9). */
export function cleDocument(demande: DemandeDocument): string {
  return demande.type === 'quittance'
    ? `quittance:${demande.locationId}:${demande.periode}`
    : `recu:${demande.paiementId}`;
}

/** Les premiers caractères alphanumériques d'un identifiant, en majuscules. */
function court(identifiant: string, longueur: number): string {
  return identifiant
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, longueur)
    .toUpperCase();
}

/** « Q-202610-3F9A2C1B » pour une quittance, « R-202610-3F9A2C1B-7D04E1 » pour un reçu (ADR-G10). */
export function numeroDocument(
  type: TypeDocument,
  periode: string,
  locationId: string,
  paiementId?: string,
): string {
  const base = `${periode.replace('-', '')}-${court(locationId, 8)}`;
  return type === 'quittance' ? `Q-${base}` : `R-${base}-${court(paiementId ?? '', 6)}`;
}
