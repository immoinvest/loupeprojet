import { resoudreAnnonce } from '../portails';
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
): unknown {
  for (const extracteur of extracteurs) {
    const brut = lireSource(document, extracteur);
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
 * Applique les règles d'un portail au document : pour chaque champ, le premier extracteur qui
 * rend une valeur conforme au schéma gagne. Un champ introuvable reste absent. Ne lève jamais.
 */
export function appliquerRegles(document: Document, regles: ReglesPortail): ChampsCapture {
  const champs: Record<string, unknown> = {};
  for (const [champ, extracteurs] of Object.entries(regles.champs)) {
    const valeur = lireChamp(document, champ as NomChampCapture, extracteurs);
    if (valeur !== undefined) champs[champ] = valeur;
  }
  return ChampsCaptureSchema.parse(champs);
}

export interface OptionsCapture {
  readonly mode: ModeCapture;
  /** Instant de la capture ; injectable pour les tests. */
  readonly maintenant?: Date | undefined;
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
    ...appliquerRegles(document, regles),
    version: VERSION_CAPTURE,
    portail: annonce.portail,
    url: annonce.urlCanonique,
    captureLe: (options.maintenant ?? new Date()).toISOString(),
    mode: options.mode,
    regles: regles.version,
  });
}
