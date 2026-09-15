/** Années proposées dans la liste de la page Déclaration. */
export const ANNEES_DECLARATION = 5;

/**
 * L'année de revenus affichée : `?annee=AAAA` si elle n'est pas dans le futur, sinon l'année
 * dernière (celle qu'on déclare au printemps).
 */
export function anneeDepuisRecherche(recherche: URLSearchParams, aujourdhui: string): number {
  const courante = Number(aujourdhui.slice(0, 4));
  const texte = recherche.get('annee') ?? '';
  return /^\d{4}$/.test(texte) && Number(texte) <= courante ? Number(texte) : courante - 1;
}

/** L'année dernière d'abord, puis l'année en cours et les plus anciennes ; l'année affichée si elle est plus ancienne. */
export function anneesProposees(aujourdhui: string, affichee: number): readonly number[] {
  const courante = Number(aujourdhui.slice(0, 4));
  const proposees = [
    courante - 1,
    courante,
    ...Array.from({ length: ANNEES_DECLARATION - 2 }, (_, rang) => courante - 2 - rang),
  ];
  return proposees.includes(affichee) ? proposees : [...proposees, affichee];
}
