import { extraireChamps, type ChampsExtraits } from '@/annonces';

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
] as const satisfies readonly (keyof ChampsExtraits & keyof ChampsIa)[];

/** Le modèle lit mieux le texte libre ; les règles comblent ce qu'il n'a pas trouvé. */
export function fusionnerChamps(regles: ChampsExtraits, ia: ChampsIa): ChampsExtraits {
  const champs: Record<string, unknown> = { ...regles };
  for (const cle of CLES) {
    const valeur = ia[cle];
    if (valeur !== null) champs[cle] = valeur;
  }
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
