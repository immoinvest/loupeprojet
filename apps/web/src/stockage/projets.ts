import { ProjetSchema, projetExemple, type ProjetEntree } from '@loupe/moteur';
import {
  migrerEnregistre,
  NOM_EXEMPLE,
  ProjetEnregistreSchema,
  AnnonceEnregistreeSchema,
  type AdresseBien,
  type AnnonceEnregistree,
  type ProjetEnregistre,
  type StatutProjet,
  type Visite,
} from '@loupe/projets';
import { z } from 'zod';

// Les schémas d'un projet enregistré sont partagés avec l'API des comptes (synchronisation).
export {
  AdresseBienSchema,
  AnnonceEnregistreeSchema,
  EtatReponseSchema,
  LONGUEUR_MAX_NOTE,
  migrerEnregistre,
  NOM_EXEMPLE,
  ProjetEnregistreSchema,
  ReponseVisiteSchema,
  StatutProjetSchema,
  VisiteSchema,
} from '@loupe/projets';
export type {
  AdresseBien,
  AnnonceEnregistree,
  EtatReponse,
  ProjetEnregistre,
  ReponseVisite,
  StatutProjet,
  Visite,
} from '@loupe/projets';

export const STATUTS: Readonly<Record<StatutProjet, string>> = {
  analyse: 'En analyse',
  visite: 'Visite prévue',
  offre: 'Offre faite',
  ecarte: 'Écarté',
  scenario: 'Scénario',
  achete: 'Acheté',
};

const ListeSchema = z.array(ProjetEnregistreSchema);

export const CLE_STOCKAGE = 'loupe.projets.v1';

/** Nom du projet d'exemple amorcé au premier lancement (défini avec les schémas partagés). */
export const NOM_PROJET_EXEMPLE = NOM_EXEMPLE;

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
  /** Photos et fiche de l'annonce lue ; écartées si elles ne passent pas la validation. */
  readonly annonce?: AnnonceEnregistree;
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
  // Une annonce invalide rendrait toute la liste illisible au prochain chargement : on la laisse de côté.
  const annonce =
    options.annonce === undefined ? null : AnnonceEnregistreeSchema.safeParse(options.annonce);
  return {
    id,
    nom: options.nom ?? nomParDefaut(source),
    statut: options.statut ?? 'analyse',
    creeLe: date,
    modifieLe: date,
    ...(options.adresse === undefined ? {} : { adresse: options.adresse }),
    ...(options.visite === undefined ? {} : { visite: options.visite }),
    ...(annonce?.success === true ? { annonce: annonce.data } : {}),
    projet: ProjetSchema.parse({ ...source, id }),
  };
}

export function nomParDefaut(source: ProjetEntree): string {
  const type = source.bien.type === 'maison' ? 'Maison' : `T${String(source.bien.pieces)}`;
  return `${type} · ${String(source.bien.surface)} m² · dépt ${source.bien.departement}`;
}
