import { resoudreAnnonce, type AnnonceResolue } from '../portails';
import {
  CaptureSchema,
  ChampsCaptureSchema,
  LONGUEUR_MAX_DESCRIPTION,
  VERSION_CAPTURE,
  type Capture,
  type ChampsCapture,
  type ModeCapture,
  type NomChampCapture,
} from '../schema';

import { convertir } from './convertir';
import type { Extracteur, ReglesPortail } from './schema';
import { lireSource } from './sources';

function lireChamp(
  document: Document,
  champ: NomChampCapture,
  extracteurs: readonly Extracteur[],
  donnees: unknown,
): unknown {
  for (const extracteur of extracteurs) {
    const brut = lireSource(document, extracteur, donnees);
    // Le regex d'un extracteur CSS est déjà appliqué à la lecture, élément par élément.
    const regex = extracteur.source === 'css' ? undefined : extracteur.regex;
    let valeur = convertir(brut, extracteur.type, { regex, diviser: extracteur.diviser });
    if (extracteur.valeur !== undefined) {
      // Présence → constante : « sans ascenseur » trouvé → false.
      valeur = convertir(brut, 'texte', { regex }) === undefined ? undefined : extracteur.valeur;
    }
    if (champ === 'description' && typeof valeur === 'string') {
      valeur = valeur.slice(0, LONGUEUR_MAX_DESCRIPTION);
    }
    const validee = ChampsCaptureSchema.shape[champ].safeParse(valeur);
    if (validee.success && validee.data !== undefined) return validee.data;
  }
  return undefined;
}

/**
 * Applique les règles d'un portail au document (et aux données chargées pour l'annonce, s'il y en
 * a) : pour chaque champ, le premier extracteur qui rend une valeur conforme au schéma gagne.
 * Un champ introuvable reste absent. Ne lève jamais.
 */
export function appliquerRegles(
  document: Document,
  regles: ReglesPortail,
  donnees?: unknown,
): ChampsCapture {
  const champs: Record<string, unknown> = {};
  for (const [champ, extracteurs] of Object.entries(regles.champs)) {
    const valeur = lireChamp(document, champ as NomChampCapture, extracteurs, donnees);
    if (valeur !== undefined) champs[champ] = valeur;
  }
  return ChampsCaptureSchema.parse(champs);
}

export interface OptionsCapture {
  readonly mode: ModeCapture;
  /** Instant de la capture ; injectable pour les tests. */
  readonly maintenant?: Date | undefined;
  /** Données de l'annonce déjà chargées (source `donnees`). */
  readonly donnees?: unknown;
}

/**
 * Lit la page d'une annonce : résout le portail depuis l'URL, applique ses règles et assemble une
 * capture validée. `null` si l'URL n'est pas une annonce du portail des règles.
 */
export function capturer(
  document: Document,
  url: string,
  regles: ReglesPortail,
  options: OptionsCapture,
): Capture | null {
  const annonce = resoudreAnnonce(url);
  if (annonce?.portail !== regles.portail) return null;
  const id = ChampsCaptureSchema.shape.id.safeParse(annonce.id);
  return CaptureSchema.parse({
    ...(id.success ? { id: id.data } : {}),
    ...appliquerRegles(document, regles, options.donnees),
    version: VERSION_CAPTURE,
    portail: annonce.portail,
    url: annonce.urlCanonique,
    captureLe: (options.maintenant ?? new Date()).toISOString(),
    mode: options.mode,
    regles: regles.version,
  });
}

/** Adresse relative des données de l'annonce (`/realEstateAd.json?id=…`), ou `null` si le portail n'en a pas. */
export function adresseDonnees(regles: ReglesPortail, annonce: AnnonceResolue): string | null {
  return regles.donnees === undefined
    ? null
    : regles.donnees.url.replaceAll('{id}', encodeURIComponent(annonce.id));
}

/** Charge une adresse relative et rend le JSON, ou `undefined` en cas d'échec. Injecté : ce paquet ne fait aucune requête. */
export type ChargeurDonnees = (adresse: string) => Promise<unknown>;

/**
 * Comme `capturer`, en chargeant d'abord les données de l'annonce quand les règles en déclarent
 * (dans le navigateur de l'utilisateur, sur le portail lui-même). Un chargement raté n'empêche
 * pas la lecture de la page.
 */
export async function capturerAvecDonnees(
  document: Document,
  url: string,
  regles: ReglesPortail,
  options: OptionsCapture & { readonly charger: ChargeurDonnees },
): Promise<Capture | null> {
  const annonce = resoudreAnnonce(url);
  const adresse = annonce === null ? null : adresseDonnees(regles, annonce);
  let donnees: unknown;
  if (adresse !== null) {
    try {
      donnees = await options.charger(adresse);
    } catch {
      donnees = undefined;
    }
  }
  return capturer(document, url, regles, { ...options, donnees });
}
