import { z } from 'zod';

import { JourSchema, PeriodeSchema } from './dates';
import { DocumentCompletSchema, DocumentSchema, IdentiteBailleurSchema } from './documents';
import {
  CHANGEMENTS_MAX,
  COLOCATAIRES_MAX,
  JOUR_LOYER_MAX,
  MONTANT_MAX_CENTIMES,
  TYPES_BIEN,
  TYPES_LOCATION,
} from './regles';

/*
 * Les objets de la gestion locative. Montants en centimes entiers (ADR-G2), dates en jours civils.
 * Les schémas « Nouveau… » décrivent ce qu'on envoie pour créer ; les autres ce qui est enregistré.
 */

const IdentifiantSchema = z.string().min(1).max(100);
const texte = (max: number): z.ZodString => z.string().trim().min(1).max(max);
const HorodatageSchema = z.string().min(1).max(40);

export const CentimesSchema = z.number().int().min(0).max(MONTANT_MAX_CENTIMES);
export const TypeBienSchema = z.enum(TYPES_BIEN);
export const TypeLocationSchema = z.enum(TYPES_LOCATION);

const champsBien = {
  nom: texte(80),
  adresse: texte(200),
  codePostal: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
  ville: texte(80).optional(),
  type: TypeBienSchema,
  surface: z.number().positive().max(10_000).optional(),
  meuble: z.boolean(),
  /** Le projet d'analyse d'où vient le bien (porte « J'ai acheté ce bien »). */
  projetId: IdentifiantSchema.optional(),
  /** Instantané des entrées du projet au jour de l'achat, pour comparer le réel au prévu. */
  projet: z.record(z.string(), z.unknown()).optional(),
};

export const NouveauBienSchema = z.object(champsBien);
export const BienGereSchema = z.object({
  id: IdentifiantSchema,
  ...champsBien,
  creeLe: HorodatageSchema,
  modifieLe: HorodatageSchema,
});

const champsLocataire = {
  prenom: texte(80),
  nom: texte(80),
  email: z.email().max(254).optional(),
};

export const NouveauLocataireSchema = z.object(champsLocataire);
export const LocataireSchema = z.object({
  id: IdentifiantSchema,
  ...champsLocataire,
  creeLe: HorodatageSchema,
});

/** Colocation à bail unique : les autres locataires du bail, dans l'ordre de saisie (ADR-G13). */
export const ColocatairesSchema = z.array(NouveauLocataireSchema).max(COLOCATAIRES_MAX);

const JourLoyerSchema = z.number().int().min(1).max(JOUR_LOYER_MAX);

const champsLocation = {
  /** Location à la chambre : ce qui distingue les locations simultanées d'un bien (« Chambre 2 »). */
  libelle: texte(40).optional(),
  type: TypeLocationSchema,
  /** Entrée du locataire. */
  debut: JourSchema,
  /** Sortie du locataire, si elle est connue. */
  fin: JourSchema.optional(),
  jourLoyer: JourLoyerSchema,
  /** Montants d'entrée ; les changements suivants vivent dans `changements` (ADR-G14). */
  loyerHorsCharges: CentimesSchema,
  charges: CentimesSchema,
  /** Aide au logement versée chaque mois au bailleur, comprise dans le loyer (ADR-G16) ; absente = 0. */
  apl: CentimesSchema.optional(),
  depot: CentimesSchema,
};

const FIN_APRES_DEBUT = {
  message: 'La sortie ne peut pas précéder l’entrée',
  path: ['fin'],
};
const finApresDebut = (l: { readonly debut: string; readonly fin?: string | undefined }): boolean =>
  l.fin === undefined || l.fin >= l.debut;

const APL_COUVERTE = {
  message: 'L’aide au logement ne peut pas dépasser le loyer charges comprises',
  path: ['apl'],
};
const aplCouverte = (m: {
  readonly loyerHorsCharges: number;
  readonly charges: number;
  readonly apl?: number | undefined;
}): boolean => (m.apl ?? 0) <= m.loyerHorsCharges + m.charges;

/** Nouveaux montants d'une location à partir d'un mois (ADR-G14). */
export const ChangementSchema = z
  .object({
    aPartirDe: PeriodeSchema,
    loyerHorsCharges: CentimesSchema,
    charges: CentimesSchema,
    apl: CentimesSchema,
  })
  .refine(aplCouverte, APL_COUVERTE);

export const NouvelleLocationSchema = z
  .object(champsLocation)
  .refine(finApresDebut, FIN_APRES_DEBUT)
  .refine(aplCouverte, APL_COUVERTE);
export const LocationGereeSchema = z
  .object({
    id: IdentifiantSchema,
    bienId: IdentifiantSchema,
    /** Le locataire en titre, saisi en premier. */
    locataireId: IdentifiantSchema,
    /** Les colocataires du même bail, dans l'ordre ; vide hors colocation. */
    colocataireIds: z.array(IdentifiantSchema).max(COLOCATAIRES_MAX),
    ...champsLocation,
    /** Les changements de montants, dans l'ordre des mois ; absents = aucun. */
    changements: z.array(ChangementSchema).max(CHANGEMENTS_MAX).optional(),
    creeLe: HorodatageSchema,
  })
  .refine(finApresDebut, FIN_APRES_DEBUT)
  .refine(aplCouverte, APL_COUVERTE);

/** « Modifier » une location : de nouveaux montants à partir d'un mois, et ce qui vaut pour tout le bail. */
export const ModificationLocationSchema = z
  .object({
    montants: ChangementSchema.optional(),
    jourLoyer: JourLoyerSchema.optional(),
    depot: CentimesSchema.optional(),
    /** `null` retire le libellé. */
    libelle: texte(40).nullable().optional(),
  })
  .refine(
    (m) =>
      m.montants !== undefined ||
      m.jourLoyer !== undefined ||
      m.depot !== undefined ||
      m.libelle !== undefined,
    { message: 'Rien à modifier', path: ['montants'] },
  );

export const SourcePaiementSchema = z.enum(['manuel']);

const champsPaiement = {
  locationId: IdentifiantSchema,
  periode: PeriodeSchema,
  montant: CentimesSchema.min(1),
  date: JourSchema,
};

export const NouveauPaiementSchema = z.object(champsPaiement);
export const PaiementSchema = z.object({
  id: IdentifiantSchema,
  ...champsPaiement,
  source: SourcePaiementSchema,
  creeLe: HorodatageSchema,
});

/** Les sections du menu affichées ; au moins une. */
export const PreferencesMenuSchema = z
  .object({ analyser: z.boolean(), gerer: z.boolean() })
  .refine((p) => p.analyser || p.gerer, {
    message: 'Au moins une section reste affichée',
    path: ['gerer'],
  });

export const PREFERENCES_PAR_DEFAUT: PreferencesMenu = { analyser: true, gerer: true };

/** Un bien, et s'il est loué, son locataire et sa location : tous les deux ou aucun. */
export const CreationLocationSchema = z
  .object({
    bien: NouveauBienSchema,
    locataire: NouveauLocataireSchema.nullable(),
    location: NouvelleLocationSchema.nullable(),
    /** Absent ou vide hors colocation. */
    colocataires: ColocatairesSchema.optional(),
  })
  .refine((c) => (c.locataire === null) === (c.location === null), {
    message: 'Un locataire va avec une location',
    path: ['location'],
  })
  .refine((c) => c.location !== null || (c.colocataires ?? []).length === 0, {
    message: 'Des colocataires vont avec une location',
    path: ['colocataires'],
  });

export const CreationReponseSchema = z.object({
  bien: BienGereSchema,
  locataire: LocataireSchema.nullable(),
  location: LocationGereeSchema.nullable(),
  colocataires: z.array(LocataireSchema),
});

export const EtatGestionSchema = z.object({
  biens: z.array(BienGereSchema),
  locataires: z.array(LocataireSchema),
  locations: z.array(LocationGereeSchema),
  paiements: z.array(PaiementSchema),
  /** Le nom et l'adresse du bailleur, ou `null` tant qu'ils n'ont pas été demandés. */
  bailleur: IdentiteBailleurSchema.nullable(),
  /** Les quittances et reçus émis, sans leur contenu. */
  documents: z.array(DocumentSchema),
  preferences: PreferencesMenuSchema,
});

/** « Exporter mes données de gestion » : l'état complet, documents avec leur contenu. */
export const ExportGestionSchema = EtatGestionSchema.omit({ documents: true }).extend({
  exporteLe: HorodatageSchema,
  documents: z.array(DocumentCompletSchema),
});

export type NouveauBien = z.infer<typeof NouveauBienSchema>;
export type BienGere = z.infer<typeof BienGereSchema>;
export type NouveauLocataire = z.infer<typeof NouveauLocataireSchema>;
export type Locataire = z.infer<typeof LocataireSchema>;
export type NouvelleLocation = z.infer<typeof NouvelleLocationSchema>;
export type LocationGeree = z.infer<typeof LocationGereeSchema>;
export type Changement = z.infer<typeof ChangementSchema>;
export type ModificationLocation = z.infer<typeof ModificationLocationSchema>;
export type NouveauPaiement = z.infer<typeof NouveauPaiementSchema>;
export type Paiement = z.infer<typeof PaiementSchema>;
export type PreferencesMenu = z.infer<typeof PreferencesMenuSchema>;
export type CreationLocation = z.infer<typeof CreationLocationSchema>;
export type CreationReponse = z.infer<typeof CreationReponseSchema>;
export type EtatGestion = z.infer<typeof EtatGestionSchema>;
export type ExportGestion = z.infer<typeof ExportGestionSchema>;
