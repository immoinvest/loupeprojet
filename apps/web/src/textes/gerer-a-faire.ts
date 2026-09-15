import { de } from './gerer-ecrans';

/** Textes du bloc « À faire » des loyers du mois (tutoiement). */
export const TEXTES_A_FAIRE = {
  titre: 'À faire',
} as const;

/** « Loyer d’Antoine en retard », « Loyer de Julie en retard ». */
export function loyerEnRetardDe(prenom: string): string {
  return `Loyer ${de(prenom)} en retard`;
}

/** « Louer Parking Prado ». */
export function louerLeBien(nom: string): string {
  return `Louer ${nom}`;
}

/** « Ajouter l’e-mail de Julie Martin », « Ajouter l’e-mail d’Antoine Dupont ». */
export function ajouterEmailDe(nom: string): string {
  return `Ajouter l’e-mail ${de(nom)}`;
}

/** « Voir l’autre », « Voir les 2 autres » : les actions au-delà des trois premières. */
export function voirLesAutres(nombre: number): string {
  return nombre > 1 ? `Voir les ${String(nombre)} autres` : 'Voir l’autre';
}
