import { captureDepuisHash, resoudreAnnonce, type Capture, type ModeCapture } from '@loupe/capture';

import { extraireChamps, type ChampsExtraits } from './extraire';
import type { AnnonceResolue } from './resoudre';

/** Ce que l'écran Nouveau projet reçoit de l'extension (lecture automatique ou clic) ou du bouton-favori. */
export interface CaptureImportee {
  readonly annonce: AnnonceResolue;
  /** Champs lus dans les données de la page, les plus sûrs. */
  readonly champsPage: ChampsExtraits;
  /** Champs de la page, complétés par ce que les règles lisent dans la description. */
  readonly champs: ChampsExtraits;
  /** Texte de l'annonce, gardé en mémoire le temps de compléter la lecture ; jamais enregistré. */
  readonly description?: string | undefined;
  readonly mode: ModeCapture;
}

export type LectureFragment =
  | { readonly statut: 'absente' }
  | { readonly statut: 'illisible' }
  | { readonly statut: 'lue'; readonly capture: CaptureImportee };

function si<K extends string, V>(cle: K, valeur: V | undefined): Partial<Record<K, V>> {
  return valeur === undefined ? {} : ({ [cle]: valeur } as Record<K, V>);
}

/** Les champs que la page donne en données structurées, aux noms du formulaire. */
export function champsStructures(capture: Capture): ChampsExtraits {
  return {
    ...si('typeBien', capture.typeBien),
    ...si('prix', capture.prix),
    ...si('surface', capture.surface),
    ...si('pieces', capture.pieces),
    ...si('chambres', capture.chambres),
    ...si('etage', capture.etage),
    ...si('ascenseur', capture.ascenseur),
    ...si('dpe', capture.dpe),
    ...si('ges', capture.ges),
    ...si('codePostal', capture.codePostal),
    ...si('ville', capture.ville),
    ...si('annee', capture.anneeConstruction),
    ...si(
      'chargesCoproMois',
      capture.chargesCopro === undefined ? undefined : Math.round(capture.chargesCopro),
    ),
    ...si('taxeFonciere', capture.taxeFonciere),
    ...si('lotsCopro', capture.lotsCopro),
    ...si('coproEnProcedure', capture.coproEnProcedure),
    ...si('meuble', capture.meuble),
  };
}

/**
 * Champs du formulaire depuis une capture : les champs structurés de la page d'abord, puis ce que
 * les règles de texte lisent dans la description pour les trous (honoraires, année, meublé…).
 */
export function champsDepuisCapture(capture: Capture): ChampsExtraits {
  const depuisTexte = capture.description === undefined ? {} : extraireChamps(capture.description);
  return { ...depuisTexte, ...champsStructures(capture) };
}

/** Portail, identifiant et URL canonique : depuis l'URL capturée, sinon depuis la capture elle-même. */
export function annonceDepuisCapture(capture: Capture): AnnonceResolue {
  return (
    resoudreAnnonce(capture.url) ?? {
      portail: capture.portail,
      id: capture.id ?? capture.url,
      urlCanonique: capture.url,
    }
  );
}

/** Une capture validée → ce que l'écran en garde. */
export function importerCapture(capture: Capture): CaptureImportee {
  return {
    annonce: annonceDepuisCapture(capture),
    champsPage: champsStructures(capture),
    champs: champsDepuisCapture(capture),
    description: capture.description,
    mode: capture.mode ?? 'extension',
  };
}

/** Lit `#capture=…` d'un `location.hash` : absente, illisible (forgée, tronquée, autre version) ou lue. */
export function lireFragmentCapture(hash: string): LectureFragment {
  const resultat = captureDepuisHash(hash);
  if (resultat === null) return { statut: 'absente' };
  if (!resultat.ok) return { statut: 'illisible' };
  return { statut: 'lue', capture: importerCapture(resultat.capture) };
}
