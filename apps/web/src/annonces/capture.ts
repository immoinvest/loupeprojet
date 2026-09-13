import { captureDepuisHash, resoudreAnnonce, type Capture } from '@loupe/capture';

import { extraireChamps, type ChampsExtraits } from './extraire';
import type { AnnonceResolue } from './resoudre';

/** Ce que l'écran Nouveau projet reçoit de l'extension ou du bouton-favori. */
export interface CaptureImportee {
  readonly annonce: AnnonceResolue;
  readonly champs: ChampsExtraits;
  readonly mode: 'extension' | 'bookmarklet';
}

export type LectureFragment =
  | { readonly statut: 'absente' }
  | { readonly statut: 'illisible' }
  | { readonly statut: 'lue'; readonly capture: CaptureImportee };

/**
 * Champs du formulaire depuis une capture : les champs structurés de la page d'abord, puis ce que
 * les règles de texte lisent dans la description pour les trous (honoraires, année, meublé…).
 * La description n'est pas conservée : elle sert ici, puis disparaît avec le fragment.
 */
export function champsDepuisCapture(capture: Capture): ChampsExtraits {
  const depuisTexte = capture.description === undefined ? {} : extraireChamps(capture.description);
  const structures: ChampsExtraits = {
    ...(capture.prix === undefined ? {} : { prix: capture.prix }),
    ...(capture.surface === undefined ? {} : { surface: capture.surface }),
    ...(capture.pieces === undefined ? {} : { pieces: capture.pieces }),
    ...(capture.chambres === undefined ? {} : { chambres: capture.chambres }),
    ...(capture.etage === undefined ? {} : { etage: capture.etage }),
    ...(capture.ascenseur === undefined ? {} : { ascenseur: capture.ascenseur }),
    ...(capture.dpe === undefined ? {} : { dpe: capture.dpe }),
    ...(capture.codePostal === undefined ? {} : { codePostal: capture.codePostal }),
    ...(capture.ville === undefined ? {} : { ville: capture.ville }),
    ...(capture.anneeConstruction === undefined ? {} : { annee: capture.anneeConstruction }),
    ...(capture.chargesCopro === undefined
      ? {}
      : { chargesCoproMois: Math.round(capture.chargesCopro) }),
    ...(capture.taxeFonciere === undefined ? {} : { taxeFonciere: capture.taxeFonciere }),
    ...(capture.meuble === undefined ? {} : { meuble: capture.meuble }),
  };
  return { ...depuisTexte, ...structures };
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

/** Lit `#capture=…` d'un `location.hash` : absente, illisible (forgée, tronquée, autre version) ou lue. */
export function lireFragmentCapture(hash: string): LectureFragment {
  const resultat = captureDepuisHash(hash);
  if (resultat === null) return { statut: 'absente' };
  if (!resultat.ok) return { statut: 'illisible' };
  const { capture } = resultat;
  return {
    statut: 'lue',
    capture: {
      annonce: annonceDepuisCapture(capture),
      champs: champsDepuisCapture(capture),
      mode: capture.mode ?? 'extension',
    },
  };
}
