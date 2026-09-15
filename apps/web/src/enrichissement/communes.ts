import type { RechercheCommunes } from './client';
import type { Commune } from './contrat';

/** Ce que le formulaire garde d'un champ « Commune » : les deux chaînes de toujours. */
export interface SaisieCommune {
  readonly codePostal: string;
  readonly ville: string;
}

/** Une ligne proposée : une commune pour un code postal. */
export interface OptionCommune {
  readonly nom: string;
  readonly codePostal: string;
  readonly codeInsee: string;
}

/** La recherche à lancer pour un texte, et le début de nom qui trie ses réponses. */
export interface RechercheSaisie {
  readonly recherche: RechercheCommunes;
  readonly filtre: string;
}

/** Au-delà, la liste deviendrait plus longue à lire qu'à taper. */
export const MAX_OPTIONS_COMMUNES = 12;

const CODE_POSTAL = /^\d{5}$/;

/**
 * « 69003 Lyon », « Lyon 69003 », « Lyon (69003) », « 69003 » ou « Lyon » → code postal et ville.
 * Sert aussi de saisie libre quand la recherche des communes ne répond pas.
 */
export function lireSaisieCommune(texte: string): SaisieCommune {
  const avant = /^\s*(\d{5})(?!\d)\s*(.*?)\s*$/.exec(texte);
  // Les groupes de ces expressions participent toujours à la correspondance.
  if (avant !== null) return { codePostal: String(avant[1]), ville: String(avant[2]) };
  // La ville finit par autre chose qu'un chiffre : « 130055 » n'est pas « 1 » au code postal 30055.
  const apres = /^\s*(.*?[^\d\s(])\s*\(?(\d{5})\)?\s*$/.exec(texte);
  if (apres !== null) return { codePostal: String(apres[2]), ville: String(apres[1]) };
  if (/^\s*\d+\s*$/.test(texte)) return { codePostal: texte.trim(), ville: '' };
  return { codePostal: '', ville: texte.trim() };
}

/** Le texte du champ pour un code postal et une ville connus : « 69003 Lyon ». */
export function texteCommune(codePostal: string, ville: string): string {
  return [codePostal.trim(), ville.trim()].filter((t) => t !== '').join(' ');
}

/** Minuscules, sans accents, tirets et apostrophes comme des espaces : « Saint-Étienne » ≈ « saint etienne ». */
export function normaliserNom(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[-'’\s]+/g, ' ')
    .trim();
}

/** Cinq chiffres (suivis ou non d'un début de nom) : par code postal ; deux lettres au moins : par nom. */
export function rechercheDepuisTexte(texte: string): RechercheSaisie | null {
  const { codePostal, ville } = lireSaisieCommune(texte);
  if (CODE_POSTAL.test(codePostal)) return { recherche: { codePostal }, filtre: ville };
  if (codePostal === '' && normaliserNom(ville).length >= 2) {
    return { recherche: { nom: ville }, filtre: '' };
  }
  return null;
}

/** Les communes reçues en lignes « commune · code postal », dans l'ordre de l'API (population d'abord). */
export function optionsCommunes(
  communes: readonly Commune[],
  { recherche, filtre }: RechercheSaisie,
): readonly OptionCommune[] {
  if ('codePostal' in recherche) {
    const debut = normaliserNom(filtre);
    return communes
      .filter((c) => normaliserNom(c.nom).startsWith(debut))
      .map((c) => ({ nom: c.nom, codePostal: recherche.codePostal, codeInsee: c.codeInsee }))
      .slice(0, MAX_OPTIONS_COMMUNES);
  }
  return communes
    .flatMap((c) =>
      [...c.codesPostaux]
        .sort()
        .map((codePostal) => ({ nom: c.nom, codePostal, codeInsee: c.codeInsee })),
    )
    .slice(0, MAX_OPTIONS_COMMUNES);
}

/**
 * Un code postal seul (rien d'autre tapé) qui ne désigne qu'une commune : on la choisit sans demander.
 * Jamais pendant qu'un nom se tape, pour ne pas remplacer le texte sous les doigts.
 */
export function optionUnique(
  options: readonly OptionCommune[],
  { recherche, filtre }: RechercheSaisie,
): OptionCommune | null {
  const [seule, ...autres] = options;
  return 'codePostal' in recherche && filtre === '' && seule !== undefined && autres.length === 0
    ? seule
    : null;
}
