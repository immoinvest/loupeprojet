// Import de l'espace de noms (et non de l'objet `z`) : les bundlers ne gardent alors que ce qui sert,
// sans les 40 locales de Zod (l'extension et le bouton-favori y gagnent 300 Ko).
import * as z from 'zod';

import { PortailSchema } from './portails';

/** Version du contrat : à incrémenter si un champ change de sens ou de type (pas pour un champ optionnel ajouté). */
export const VERSION_CAPTURE = 1;

/** La description sert à l'extraction par règles côté web, puis est jetée : inutile d'en porter plus. */
export const LONGUEUR_MAX_DESCRIPTION = 4_000;

/** Photos gardées d'une annonce, et longueur maximale de chaque adresse. */
export const PHOTOS_MAX = 30;
export const LONGUEUR_MAX_URL_PHOTO = 500;

export const ClasseEnergieCaptureSchema = z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
export type ClasseEnergieCapture = z.infer<typeof ClasseEnergieCaptureSchema>;

/** `serveur` : la page a été récupérée par le Worker de Deklic (ADR-008), puis lue dans le navigateur. */
export const ModeCaptureSchema = z.enum(['extension', 'bookmarklet', 'serveur']);
export type ModeCapture = z.infer<typeof ModeCaptureSchema>;

export const TypeBienCaptureSchema = z.enum(['appartement', 'maison']);
export type TypeBienCapture = z.infer<typeof TypeBienCaptureSchema>;

/** Mêmes valeurs que l'état du bien du moteur. */
export const EtatCaptureSchema = z.enum(['a_renover', 'a_rafraichir', 'bon_etat', 'renove']);
export type EtatCapture = z.infer<typeof EtatCaptureSchema>;

export const ChauffageEnergieCaptureSchema = z.enum([
  'electricite',
  'gaz',
  'fioul',
  'bois',
  'pompe_a_chaleur',
  'reseau_de_chaleur',
  'autre',
]);
export type ChauffageEnergieCapture = z.infer<typeof ChauffageEnergieCaptureSchema>;

export const ChargeHonorairesCaptureSchema = z.enum(['acquereur', 'vendeur']);
export type ChargeHonorairesCapture = z.infer<typeof ChargeHonorairesCaptureSchema>;

export const VendeurCaptureSchema = z.enum(['pro', 'particulier']);
export type VendeurCapture = z.infer<typeof VendeurCaptureSchema>;

/** Adresses des photos, affichées depuis le portail : https seulement, jamais de copie. */
export const PhotosCaptureSchema = z
  .array(z.url({ protocol: /^https$/ }).max(LONGUEUR_MAX_URL_PHOTO))
  .min(1)
  .max(PHOTOS_MAX);

const DateCaptureSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const booleen = (): z.ZodOptional<z.ZodBoolean> => z.boolean().optional();

/** Les champs lus sur la page, tous optionnels : ce que la page ne dit pas reste absent. */
export const ChampsCaptureSchema = z.object({
  id: z.string().trim().min(1).max(100).optional(),
  typeBien: TypeBienCaptureSchema.optional(),
  prix: z.number().positive().optional(),
  surface: z.number().positive().optional(),
  pieces: z.number().int().positive().optional(),
  chambres: z.number().int().nonnegative().optional(),
  ville: z.string().trim().min(1).max(80).optional(),
  codePostal: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
  adresse: z.string().trim().min(1).max(200).optional(),
  etage: z.number().int().min(-5).max(100).optional(),
  ascenseur: booleen(),
  dpe: ClasseEnergieCaptureSchema.optional(),
  ges: ClasseEnergieCaptureSchema.optional(),
  /** Charges de copropriété, en euros par mois. */
  chargesCopro: z.number().nonnegative().optional(),
  /** Taxe foncière, en euros par an. */
  taxeFonciere: z.number().nonnegative().optional(),
  anneeConstruction: z.number().int().min(1000).max(2100).optional(),
  /** Nombre de lots de la copropriété. */
  lotsCopro: z.number().int().positive().max(10_000).optional(),
  /** Copropriété faisant l'objet d'une procédure (plan de sauvegarde, administration provisoire…). */
  coproEnProcedure: booleen(),
  meuble: booleen(),
  description: z.string().max(LONGUEUR_MAX_DESCRIPTION).optional(),
  photos: PhotosCaptureSchema.optional(),
  /** Chauffage collectif (`true`) ou individuel (`false`). */
  chauffageCollectif: booleen(),
  chauffageEnergie: ChauffageEnergieCaptureSchema.optional(),
  etat: EtatCaptureSchema.optional(),
  /** Nombre d'étages de l'immeuble. */
  etagesImmeuble: z.number().int().min(0).max(100).optional(),
  balcon: booleen(),
  terrasse: booleen(),
  jardin: booleen(),
  cave: booleen(),
  parking: booleen(),
  gardien: booleen(),
  digicode: booleen(),
  interphone: booleen(),
  piscine: booleen(),
  climatisation: booleen(),
  cheminee: booleen(),
  accessiblePmr: booleen(),
  /** Salles de bain et salles d'eau. */
  sallesEau: z.number().int().min(0).max(20).optional(),
  /** Honoraires d'agence TTC, en euros. */
  honoraires: z.number().positive().optional(),
  honorairesACharge: ChargeHonorairesCaptureSchema.optional(),
  /** Estimation des dépenses d'énergie du DPE, en euros par an. */
  budgetEnergieMin: z.number().nonnegative().optional(),
  budgetEnergieMax: z.number().nonnegative().optional(),
  /** Consommation d'énergie primaire du DPE, en kWh/m²/an. */
  consommationEnergie: z.number().int().min(0).max(2_000).optional(),
  dateDpe: DateCaptureSchema.optional(),
  quartier: z.string().trim().min(1).max(80).optional(),
  vendeur: VendeurCaptureSchema.optional(),
  publieeLe: DateCaptureSchema.optional(),
});
export type ChampsCapture = z.infer<typeof ChampsCaptureSchema>;
export type NomChampCapture = keyof ChampsCapture;

/**
 * La fiche du bien gardée avec le projet : ce que l'annonce décrit sans que le calcul l'utilise
 * directement. Ni texte, ni photo, ni donnée sur le vendeur autre que pro ou particulier.
 */
export const FicheAnnonceSchema = ChampsCaptureSchema.pick({
  chauffageCollectif: true,
  chauffageEnergie: true,
  etat: true,
  etagesImmeuble: true,
  balcon: true,
  terrasse: true,
  jardin: true,
  cave: true,
  parking: true,
  gardien: true,
  digicode: true,
  interphone: true,
  piscine: true,
  climatisation: true,
  cheminee: true,
  accessiblePmr: true,
  sallesEau: true,
  honoraires: true,
  honorairesACharge: true,
  budgetEnergieMin: true,
  budgetEnergieMax: true,
  consommationEnergie: true,
  dateDpe: true,
  quartier: true,
  vendeur: true,
  publieeLe: true,
});
export type FicheAnnonce = z.infer<typeof FicheAnnonceSchema>;
export const CHAMPS_FICHE = Object.keys(
  FicheAnnonceSchema.shape,
) as readonly (keyof FicheAnnonce)[];

/**
 * Ce que l'extension ou le bouton-favori transmet au web dans le fragment d'URL.
 * Jamais le HTML de la page, jamais de donnée sur le visiteur : seulement l'annonce.
 */
export const CaptureSchema = ChampsCaptureSchema.extend({
  version: z.literal(VERSION_CAPTURE),
  portail: PortailSchema,
  url: z.url(),
  /** Instant de la lecture, ISO 8601 en UTC. */
  captureLe: z.iso.datetime(),
  mode: ModeCaptureSchema.optional(),
  /** Version du fichier de règles appliqué, ex. `leboncoin-2026-09-13`. */
  regles: z.string().min(1).max(60).optional(),
});
export type Capture = z.infer<typeof CaptureSchema>;
