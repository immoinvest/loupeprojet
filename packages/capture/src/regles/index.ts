export {
  adresseDonnees,
  appliquerRegles,
  capturer,
  capturerAvecDonnees,
  type ChargeurDonnees,
  type OptionsCapture,
} from './appliquer';
export { lireChemin } from './chemin';
export { convertir, normaliserTexte, type ValeurConvertie } from './convertir';
export { creerRegistre, type Registre } from './registre';
export {
  DonneesPortailSchema,
  ExtracteurSchema,
  NomChampCaptureSchema,
  ReglesPortailSchema,
  TypeValeurSchema,
  type DonneesPortail,
  type Extracteur,
  type ReglesPortail,
  type TypeValeur,
} from './schema';
export { analyserJson, lireSource, texteVisible } from './sources';
