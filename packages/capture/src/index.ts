/**
 * @loupe/capture — contrat de capture d'une annonce, partagé par l'extension, le bouton-favori
 * et l'application web. Aucune requête réseau, aucun stockage : des fonctions pures sur des
 * chaînes et des documents.
 */
export {
  CHEMIN_NOUVEAU_PROJET,
  CLE_FRAGMENT,
  captureDepuisHash,
  decoderCapture,
  encoderCapture,
  urlDeCapture,
  type RaisonDecodage,
  type ResultatDecodage,
} from './encodage';
export {
  PORTAILS,
  PortailSchema,
  resoudreAnnonce,
  type AnnonceResolue,
  type Portail,
} from './portails';
export {
  CaptureSchema,
  ChampsCaptureSchema,
  ClasseEnergieCaptureSchema,
  LONGUEUR_MAX_DESCRIPTION,
  ModeCaptureSchema,
  VERSION_CAPTURE,
  type Capture,
  type ChampsCapture,
  type ClasseEnergieCapture,
  type ModeCapture,
  type NomChampCapture,
} from './schema';
