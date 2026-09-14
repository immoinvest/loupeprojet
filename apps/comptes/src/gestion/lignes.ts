import type { D1PreparedStatement } from '@cloudflare/workers-types';
import {
  BienGereSchema,
  DocumentCompletSchema,
  DocumentSchema,
  IdentiteBailleurSchema,
  LocataireSchema,
  LocationGereeSchema,
  PaiementSchema,
  PREFERENCES_PAR_DEFAUT,
  PreferencesMenuSchema,
  type BienGere,
  type DocumentComplet,
  type DocumentGestion,
  type IdentiteBailleur,
  type Locataire,
  type LocationGeree,
  type Paiement,
  type PreferencesMenu,
} from '@loupe/gestion';

/** Une ligne telle que D1 la rend : colonnes nommées, NULL pour « absent », booléens en 0/1. */
export type Ligne = Readonly<Record<string, unknown>>;

export type ValeurSql = string | number | null;

/** Une requête préparée, valeurs converties pour D1 (partagé par les trois parties du dépôt). */
export type Lier = (
  sql: string,
  ...valeurs: (string | number | boolean | undefined)[]
) => D1PreparedStatement;

/** Pour D1 : `undefined` devient NULL, un booléen 0 ou 1. */
export function valeurSql(valeur: string | number | boolean | undefined): ValeurSql {
  if (valeur === undefined) return null;
  if (typeof valeur === 'boolean') return valeur ? 1 : 0;
  return valeur;
}

/** Les schémas ont des champs optionnels, pas nullables : une colonne NULL est un champ absent. */
function sansNulls(ligne: Ligne): Record<string, unknown> {
  return Object.fromEntries(Object.entries(ligne).filter(([, valeur]) => valeur !== null));
}

/** L'instantané du projet, s'il se relit comme un objet ; un contenu abîmé est ignoré, pas fatal. */
function lireProjet(texte: unknown): Record<string, unknown> | undefined {
  if (typeof texte !== 'string') return undefined;
  try {
    const valeur: unknown = JSON.parse(texte);
    const estObjet = typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);
    return estObjet ? (valeur as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

export function versBien(ligne: Ligne): BienGere {
  const { projet, meuble, ...reste } = sansNulls(ligne);
  const instantane = lireProjet(projet);
  return BienGereSchema.parse({
    ...reste,
    meuble: meuble === 1,
    ...(instantane === undefined ? {} : { projet: instantane }),
  });
}

export function versLocataire(ligne: Ligne): Locataire {
  return LocataireSchema.parse(sansNulls(ligne));
}

/** La location et ses colocataires, lus à part dans gestion_colocataire (ADR-G13). */
export function versLocation(ligne: Ligne, colocataireIds: readonly string[]): LocationGeree {
  return LocationGereeSchema.parse({ ...sansNulls(ligne), colocataireIds });
}

/** Les colocataires de chaque location, dans l'ordre du bail (lignes triées par location puis ordre). */
export function colocatairesParLocation(
  lignes: readonly Ligne[],
): ReadonlyMap<string, readonly string[]> {
  const parLocation = new Map<string, string[]>();
  for (const ligne of lignes) {
    const locationId = String(ligne.locationId);
    parLocation.set(locationId, [
      ...(parLocation.get(locationId) ?? []),
      String(ligne.locataireId),
    ]);
  }
  return parLocation;
}

export function versPaiement(ligne: Ligne): Paiement {
  return PaiementSchema.parse(sansNulls(ligne));
}

/** Sans ligne enregistrée, les deux sections du menu sont affichées. */
export function versPreferences(ligne: Ligne | undefined): PreferencesMenu {
  if (ligne === undefined) return PREFERENCES_PAR_DEFAUT;
  return PreferencesMenuSchema.parse({ analyser: ligne.analyser === 1, gerer: ligne.gerer === 1 });
}

/** Sans ligne, pas encore d'identité : elle sera demandée à la première quittance. */
export function versBailleur(ligne: Ligne | undefined): IdentiteBailleur | null {
  return ligne === undefined ? null : IdentiteBailleurSchema.parse(ligne);
}

/** Un document tel que l'état le liste : sans son contenu. */
export function versDocument(ligne: Ligne): DocumentGestion {
  return DocumentSchema.parse(sansNulls(ligne));
}

/** Le contenu figé, relu et revalidé : un contenu abîmé est une erreur interne, jamais un document faux. */
export function versDocumentComplet(ligne: Ligne): DocumentComplet {
  const { contenu, ...reste } = sansNulls(ligne);
  return DocumentCompletSchema.parse({ ...reste, contenu: JSON.parse(String(contenu)) as unknown });
}
