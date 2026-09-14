import { extraireChamps, type CaptureImportee, type ChampsExtraits } from '@/annonces';

import type { ClientWorker } from './client';
import type { ChampsIa } from './contrat';

export type ModeLecture = 'ia' | 'regles';

export interface LectureAnnonce {
  readonly champs: ChampsExtraits;
  readonly mode: ModeLecture;
}

/** En dessous, le Worker refuse le texte (400) : inutile de l'appeler. */
export const LONGUEUR_MIN_IA = 40;

const CLES = [
  'prix',
  'surface',
  'pieces',
  'chambres',
  'etage',
  'ascenseur',
  'dpe',
  'codePostal',
  'ville',
  'annee',
  'chargesCoproMois',
  'taxeFonciere',
  'honorairesAgence',
  'meuble',
  'etat',
  'exterieur',
] as const satisfies readonly (keyof ChampsExtraits & keyof ChampsIa)[];

/** Le modèle lit mieux le texte libre ; les règles comblent ce qu'il n'a pas trouvé. */
export function fusionnerChamps(regles: ChampsExtraits, ia: ChampsIa): ChampsExtraits {
  const champs: Record<string, unknown> = { ...regles };
  for (const cle of CLES) {
    const valeur = ia[cle];
    if (valeur !== null && valeur !== undefined) champs[cle] = valeur;
  }
  // Le type de location du modèle devient le type du formulaire.
  if (ia.typeLocation !== null && ia.typeLocation !== undefined) champs.mode = ia.typeLocation;
  // Un loyer actuel lu par le modèle : le bien est vendu loué, sauf mention « libre » lue par les règles.
  if ((ia.loyerActuel ?? 0) > 0 && regles.venduLoue !== false) champs.venduLoue = true;
  return champs;
}

/**
 * Lit le texte collé : lecture par le modèle quand le Worker répond, par règles sinon.
 * Le texte part au Worker pour la lecture et n'est conservé nulle part.
 */
export async function lireAnnonce(texte: string, client: ClientWorker): Promise<LectureAnnonce> {
  const regles = extraireChamps(texte);
  if (texte.trim().length < LONGUEUR_MIN_IA) return { champs: regles, mode: 'regles' };
  const ia = await client.extraire(texte);
  return ia.ok
    ? { champs: fusionnerChamps(regles, ia.valeur), mode: 'ia' }
    : { champs: regles, mode: 'regles' };
}

/** Les champs que le texte donne souvent et que les données des portails oublient. */
const CHAMPS_DU_TEXTE = [
  'etage',
  'ascenseur',
  'dpe',
  'annee',
  'chargesCoproMois',
  'taxeFonciere',
  'honorairesAgence',
] as const satisfies readonly (keyof ChampsExtraits)[];

export interface CaptureCompletee {
  readonly capture: CaptureImportee;
  /** `ia` quand le modèle a complété la lecture, `null` sinon (rien à compléter, ou Worker indisponible). */
  readonly mode: ModeLecture | null;
}

/**
 * Après une lecture de la page par l'extension : s'il manque des champs que le texte donne souvent,
 * l'IA lit la description. Les données de la page restent prioritaires, l'IA comble les trous.
 */
export async function completerAvecIa(
  importee: CaptureImportee,
  client: ClientWorker,
): Promise<CaptureCompletee> {
  const manque = CHAMPS_DU_TEXTE.some((cle) => importee.champs[cle] === undefined);
  if (importee.description === undefined || !manque) return { capture: importee, mode: null };
  const lecture = await lireAnnonce(importee.description, client);
  if (lecture.mode !== 'ia') return { capture: importee, mode: null };
  return {
    capture: { ...importee, champs: { ...lecture.champs, ...importee.champsPage } },
    mode: 'ia',
  };
}
