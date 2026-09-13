import type { Portail } from '../portails';

import { ReglesPortailSchema, type ReglesPortail } from './schema';

/** Les règles connues, indexées par portail. Point d'entrée unique, remplaçable un jour par un chargement distant. */
export interface Registre {
  readonly reglesDuPortail: (portail: Portail) => ReglesPortail | undefined;
  /** Version en vigueur pour chaque portail connu, ex. `{ leboncoin: 'leboncoin-2026-09-13' }`. */
  readonly versions: () => Readonly<Partial<Record<Portail, string>>>;
}

/**
 * Valide des fichiers de règles (JSON importés ou téléchargés) et les indexe par portail.
 * Lève si un fichier est invalide ou si deux fichiers visent le même portail : mieux vaut
 * échouer au chargement qu'en silence sur la page d'une annonce.
 */
export function creerRegistre(fichiers: readonly unknown[]): Registre {
  const parPortail = new Map<Portail, ReglesPortail>();
  for (const fichier of fichiers) {
    const regles = ReglesPortailSchema.parse(fichier);
    if (parPortail.has(regles.portail)) {
      throw new Error(`Deux fichiers de règles pour le portail ${regles.portail}`);
    }
    parPortail.set(regles.portail, regles);
  }
  return {
    reglesDuPortail: (portail) => parPortail.get(portail),
    versions: () => Object.fromEntries([...parPortail].map(([portail, r]) => [portail, r.version])),
  };
}
