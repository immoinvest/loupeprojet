import { CHAMPS_FICHE, type Capture, type FicheAnnonce } from '@loupe/capture';

/** Ce que le projet garde de l'annonce lue : ses photos (adresses), sa fiche et la date de lecture. */
export interface AnnonceLue {
  readonly photos?: string[];
  readonly fiche: FicheAnnonce;
  readonly lueLe: string;
}

/** La fiche du bien : les champs descriptifs de la capture, sans texte, photo ni prix. */
export function ficheDepuisCapture(capture: Capture): FicheAnnonce {
  const fiche: Record<string, unknown> = {};
  for (const champ of CHAMPS_FICHE) {
    if (capture[champ] !== undefined) fiche[champ] = capture[champ];
  }
  return fiche;
}

/**
 * Balcon, terrasse ou jardin : vrai si l'annonce en cite un ; faux seulement si elle dit les trois
 * absents ; inconnu sinon (« pas de balcon » ne dit rien du jardin).
 */
export function exterieurDepuis(
  capture: Pick<Capture, 'balcon' | 'terrasse' | 'jardin'>,
): boolean | undefined {
  const valeurs = [capture.balcon, capture.terrasse, capture.jardin];
  if (valeurs.includes(true)) return true;
  return valeurs.every((v) => v === false) ? false : undefined;
}

/** Les honoraires ne comptent dans le coût d'achat que s'ils sont à la charge de l'acquéreur. */
export function honorairesAcquereur(
  capture: Pick<Capture, 'honoraires' | 'honorairesACharge'>,
): number | undefined {
  return capture.honorairesACharge === 'acquereur' ? capture.honoraires : undefined;
}

/** Les portails d'où viennent les annonces, et leurs sous-domaines (img.leboncoin.fr, mms.seloger.com…). */
const DOMAINES_PORTAILS = [
  'leboncoin.fr',
  'seloger.com',
  'logic-immo.com',
  'pap.fr',
  'bienici.com',
];

/**
 * Une adresse https sur l'un des cinq portails. Un projet reçu par lien peut avoir été forgé : on
 * n'affiche ni une image d'un autre site (traceur), ni un lien `javascript:`.
 */
export function surUnPortail(adresse: string): boolean {
  let url: URL;
  try {
    url = new URL(adresse);
  } catch {
    return false;
  }
  const hote = url.hostname.toLowerCase();
  return (
    url.protocol === 'https:' &&
    DOMAINES_PORTAILS.some((domaine) => hote === domaine || hote.endsWith(`.${domaine}`))
  );
}

/** L'annonce à enregistrer avec le projet ; `undefined` si elle n'apporte ni photo ni fiche. */
export function annonceLue(
  photos: readonly string[] | undefined,
  fiche: FicheAnnonce,
  lueLe: string,
): AnnonceLue | undefined {
  const avecPhotos = photos !== undefined && photos.length > 0;
  if (!avecPhotos && Object.keys(fiche).length === 0) return undefined;
  return { ...(avecPhotos ? { photos: [...photos] } : {}), fiche, lueLe };
}
