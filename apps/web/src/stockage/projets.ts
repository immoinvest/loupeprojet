import { ProjetSchema, migrerProjet, projetExemple, type ProjetEntree } from '@loupe/moteur';
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

export const STATUTS: Readonly<Record<StatutProjet, string>> = {
  analyse: 'En analyse',
  visite: 'Visite prévue',
  offre: 'Offre faite',
  ecarte: 'Écarté',
  scenario: 'Scénario',
  achete: 'Acheté',
};

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

export const ProjetEnregistreSchema = z.object({
  id: z.string().min(1),
  nom: z.string().min(1),
  statut: StatutProjetSchema,
  creeLe: z.string(),
  modifieLe: z.string(),
  adresse: AdresseBienSchema.optional(),
  /** Absente : visite non faite, aucune réponse (projets enregistrés avant cette feature). */
  visite: VisiteSchema.optional(),
  projet: ProjetSchema,
});
export type ProjetEnregistre = z.infer<typeof ProjetEnregistreSchema>;

const ListeSchema = z.array(ProjetEnregistreSchema);

export const CLE_STOCKAGE = 'loupe.projets.v1';

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

/** Lit la liste ; un contenu absent ou invalide donne une liste vide (jamais d'exception). */
export function lireProjets(stockage: Storage): ProjetEnregistre[] {
  const brut = stockage.getItem(CLE_STOCKAGE);
  if (brut === null) return [];
  try {
    const json: unknown = JSON.parse(brut);
    const liste = Array.isArray(json) ? json.map(migrerEnregistre) : json;
    const resultat = ListeSchema.safeParse(liste);
    return resultat.success ? resultat.data : [];
  } catch {
    return [];
  }
}

export function ecrireProjets(stockage: Storage, projets: readonly ProjetEnregistre[]): void {
  stockage.setItem(CLE_STOCKAGE, JSON.stringify(projets));
}

export interface OptionsCreation {
  readonly nom?: string;
  readonly statut?: StatutProjet;
  readonly source?: ProjetEntree;
  /** Adresse exacte et visite reprises d'un projet reçu par lien, ou visite déjà faite à la création. */
  readonly adresse?: AdresseBien;
  readonly visite?: Visite;
  readonly maintenant?: () => string;
  readonly genererId?: () => string;
}

/** Crée un projet à partir de l'exemple (ou d'une source), avec un identifiant neuf. */
export function creerProjet(options: OptionsCreation = {}): ProjetEnregistre {
  const maintenant = options.maintenant ?? ((): string => new Date().toISOString());
  const genererId = options.genererId ?? ((): string => crypto.randomUUID());
  const source = options.source ?? projetExemple;
  const id = genererId();
  const date = maintenant();
  return {
    id,
    nom: options.nom ?? nomParDefaut(source),
    statut: options.statut ?? 'analyse',
    creeLe: date,
    modifieLe: date,
    ...(options.adresse === undefined ? {} : { adresse: options.adresse }),
    ...(options.visite === undefined ? {} : { visite: options.visite }),
    projet: ProjetSchema.parse({ ...source, id }),
  };
}

export function nomParDefaut(source: ProjetEntree): string {
  const type = source.bien.type === 'maison' ? 'Maison' : `T${String(source.bien.pieces)}`;
  return `${type} · ${String(source.bien.surface)} m² · dépt ${source.bien.departement}`;
}
