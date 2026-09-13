import type { Capture } from '../src';

/** Une capture réduite au strict nécessaire : portail, adresse, date. */
export const CAPTURE_MINIMALE: Capture = {
  version: 1,
  portail: 'leboncoin',
  url: 'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851',
  captureLe: '2026-09-13T10:41:00.000Z',
};

/** Le T3 de Marseille 5e du projet d'exemple, tel que l'extension le lirait. */
export const CAPTURE_COMPLETE: Capture = {
  ...CAPTURE_MINIMALE,
  id: '2214738851',
  prix: 155_000,
  surface: 65,
  pieces: 3,
  chambres: 2,
  ville: 'Marseille',
  codePostal: '13005',
  adresse: 'Quartier Baille, Marseille 5e',
  etage: 3,
  ascenseur: false,
  dpe: 'D',
  ges: 'B',
  chargesCopro: 90,
  taxeFonciere: 1_050,
  anneeConstruction: 1962,
  meuble: true,
  description: "Appartement T3 de 65 m² au 3e étage sans ascenseur d'un immeuble de 1962.",
  mode: 'extension',
  regles: 'leboncoin-2026-09-13',
};
