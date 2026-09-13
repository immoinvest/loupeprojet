/**
 * @loupe/capture — contrat de capture d'une annonce, partagé par l'extension, le bouton-favori
 * et l'application web. Aucune requête réseau, aucun stockage : des fonctions pures sur des
 * chaînes et des documents (les chargements éventuels sont injectés).
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
  MessageExtensionSchema,
  MessageWebSchema,
  RaisonEchecLectureSchema,
  ResultatLectureAutoSchema,
  SOURCE_EXTENSION,
  SOURCE_WEB,
  VERSION_PONT,
  type MessageExtension,
  type MessageWeb,
  type RaisonEchecLecture,
  type ResultatLectureAuto,
} from './pont';
export {
  MOTIFS_PORTAILS,
  PORTAILS,
  PortailSchema,
  resoudreAnnonce,
  type AnnonceResolue,
  type Portail,
} from './portails';
export * from './regles';
export {
  CaptureSchema,
  ChampsCaptureSchema,
  ClasseEnergieCaptureSchema,
  LONGUEUR_MAX_DESCRIPTION,
  ModeCaptureSchema,
  TypeBienCaptureSchema,
  VERSION_CAPTURE,
  type Capture,
  type ChampsCapture,
  type ClasseEnergieCapture,
  type ModeCapture,
  type NomChampCapture,
  type TypeBienCapture,
} from './schema';
