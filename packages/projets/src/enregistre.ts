import { FicheAnnonceSchema, PhotosCaptureSchema } from '@loupe/capture/schema';
import { migrerProjet, ProjetSchema } from '@loupe/moteur';
import { z } from 'zod';

export const StatutProjetSchema = z.enum([
  'analyse',
  'visite',
  'offre',
  'ecarte',
  'scenario',
  // Posé par la porte « J'ai acheté ce bien » de Gérer.
  'achete',
]);
export type StatutProjet = z.infer<typeof StatutProjetSchema>;

/** Adresse exacte du bien, précisée par l'utilisateur (agence, diagnostics) : sert à l'analyse DVF à l'adresse. */
export const AdresseBienSchema = z.object({
  libelle: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  codeInsee: z.string().regex(/^(\d{5}|2[AB]\d{3})$/),
  codeVoie: z.string().nullable(),
  numero: z.number().int().nonnegative().nullable(),
  /** Code postal de l'adresse géocodée : désigne l'arrondissement pour le loyer de marché. */
  codePostal: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
});
export type AdresseBien = z.infer<typeof AdresseBienSchema>;

export const EtatReponseSchema = z.enum(['a_verifier', 'ok', 'probleme', 'sans_objet']);
export type EtatReponse = z.infer<typeof EtatReponseSchema>;

/** Une note reste courte : elle voyage dans le lien de partage avec tout le projet. */
export const LONGUEUR_MAX_NOTE = 300;

export const ReponseVisiteSchema = z.object({
  etat: EtatReponseSchema,
  note: z.string().max(LONGUEUR_MAX_NOTE).optional(),
});
export type ReponseVisite = z.infer<typeof ReponseVisiteSchema>;

/**
 * La visite du bien : faite ou non, et les réponses données, par identifiant de question de la
 * base du moteur. Une réponse dont l'identifiant n'existe plus est ignorée à l'affichage.
 */
export const VisiteSchema = z.object({
  faite: z.boolean(),
  /** Date ISO du jour où la visite a été marquée faite. */
  date: z.string().optional(),
  reponses: z.record(z.string(), ReponseVisiteSchema).default({}),
});
export type Visite = z.infer<typeof VisiteSchema>;

/**
 * L'annonce lue quand le projet a été créé depuis un lien : adresses des photos (sur le portail,
 * jamais copiées), fiche du bien et date de lecture. Ni texte, ni donnée sur le vendeur.
 */
export const AnnonceEnregistreeSchema = z.object({
  photos: PhotosCaptureSchema.optional(),
  fiche: FicheAnnonceSchema,
  lueLe: z.string(),
});
export type AnnonceEnregistree = z.infer<typeof AnnonceEnregistreeSchema>;

export const ProjetEnregistreSchema = z.object({
  id: z.string().min(1),
  nom: z.string().min(1),
  statut: StatutProjetSchema,
  creeLe: z.string(),
  modifieLe: z.string(),
  adresse: AdresseBienSchema.optional(),
  /** Absente : visite non faite, aucune réponse (projets enregistrés avant cette feature). */
  visite: VisiteSchema.optional(),
  /** Absente : projet saisi à la main, ou créé avant la lecture enrichie des annonces. */
  annonce: AnnonceEnregistreeSchema.optional(),
  projet: ProjetSchema,
});
export type ProjetEnregistre = z.infer<typeof ProjetEnregistreSchema>;

/**
 * Un projet enregistré dans un format antérieur est migré avant validation (types d'exploitation de
 * septembre 2026) : les projets déjà enregistrés et les liens de partage continuent de se charger.
 */
export function migrerEnregistre(brut: unknown): unknown {
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut) || !('projet' in brut)) {
    return brut;
  }
  return { ...brut, projet: migrerProjet(brut.projet) };
}

/**
 * La date d'une modification : maintenant, et toujours après la précédente. Deux modifications dans la
 * même milliseconde auraient la même date, et le compte, à date égale, garderait la première.
 */
export function dateDeModification(precedente: string, maintenant: Date = new Date()): string {
  const apres = Date.parse(precedente) + 1;
  return new Date(Math.max(maintenant.getTime(), Number.isNaN(apres) ? 0 : apres)).toISOString();
}

/** Le nom du projet d'exemple posé au premier lancement d'un appareil. */
export const NOM_EXEMPLE = 'T3 · 65 m² · Marseille 5e';

/**
 * Le projet d'exemple jamais touché : même nom, jamais modifié depuis sa création, ni adresse ni
 * visite. Il n'est pas versé dans un compte qui a déjà des projets (sinon un doublon par appareil).
 */
export function estExempleIntact(p: ProjetEnregistre): boolean {
  return (
    p.nom === NOM_EXEMPLE &&
    p.creeLe === p.modifieLe &&
    p.adresse === undefined &&
    p.visite === undefined
  );
}
