import type { CodeGroupe, ReferenceAdresse } from '@/enrichissement';
import { euros, pourcentageSigne } from '@/formatage/nombres';

export const LIBELLES_GROUPES: Readonly<Record<CodeGroupe, string>> = {
  meme_parcelle: 'Même immeuble',
  parcelles_voisines: 'Parcelles voisines',
  meme_cote: 'Même côté de la rue',
  en_face: 'En face',
  rayon_100: 'À moins de 100 m',
  rayon_200: 'À moins de 200 m',
  rayon_300: 'À moins de 300 m',
};

export const PHRASES_ADRESSE = {
  cadastreIndisponible:
    "Le cadastre ne répond pas : l'immeuble et les parcelles voisines ne sont pas analysés.",
  sansVentes: "Aucune vente publiée pour cette commune pour l'instant.",
  sansRepere: 'Moins de 5 ventes comparables à chaque échelle : pas de repère fiable.',
  introuvable: 'Adresse introuvable : vérifiez le numéro, la rue et la ville.',
  indisponible: "L'analyse est indisponible pour le moment. Réessayez dans un instant.",
  repereUtilise: 'Repère utilisé par le rapport.',
  numeroCadastre:
    "Ce numéro vient du cadastre : choisissez l'adresse dans la liste des suggestions, ou tapez le nom de la résidence.",
  aucuneSuggestion:
    "Aucune suggestion : vérifiez l'orthographe, ou tapez seulement la rue et la ville.",
  suggestionsIndisponibles:
    "Suggestions indisponibles pour le moment : tapez l'adresse complète puis « Analyser ».",
  sansNumero:
    'Analyse sans numéro : les ventes du même immeuble et du même côté de la rue ne sont pas comparées.',
  adresseCadastre:
    "Adresse du cadastre : les ventes de l'immeuble sont retrouvées par son numéro fiscal.",
  numeroInvalide: 'Tapez un numéro, par exemple 144 ou 144 bis.',
} as const;

/** « Suggestions d'abord dans le département 13. » ; rien sans département. */
export function phraseContexte(departement: string): string | null {
  const d = departement.trim();
  return d === '' ? null : `Suggestions d'abord dans le département ${d}.`;
}

/** Précision d'une suggestion, à droite de son libellé. */
export function detailSuggestion(precision: string): string | undefined {
  if (precision === 'rue') return 'rue, sans numéro';
  if (precision === 'lieu_dit') return 'lieu-dit';
  return undefined;
}

/** « adresse du cadastre, 3 ventes connues ». */
export function detailCadastre(ventes: number): string {
  return `adresse du cadastre, ${String(ventes)} vente${ventes > 1 ? 's' : ''} connue${ventes > 1 ? 's' : ''}`;
}

/** « Numéro dans Rue de l'Olivier 13005 Marseille ? ». */
export function questionNumero(libelle: string): string {
  return `Numéro dans ${libelle} ?`;
}

/** Le géocodage doit trouver le numéro : à la rue près, les groupes « même côté » et « en face » n'ont pas de sens. */
export function phrasePrecision(precision: string): string | null {
  if (precision === 'adresse') return null;
  return precision === 'rue'
    ? 'Adresse trouvée à la rue seulement : ajoutez le numéro.'
    : 'Adresse trop imprécise : indiquez le numéro, la rue et la ville.';
}

export function prixM2(montant: number): string {
  return `${euros(montant)}/m²`;
}

/** « Même côté de la rue : 6 ventes, médiane 3 600 €/m². Ce bien est à −34 %. » */
export function phraseReference(reference: ReferenceAdresse, ecart: number): string {
  const s = reference.statistiques;
  return `${LIBELLES_GROUPES[reference.code]} : ${String(s.ventes)} ventes comparables, médiane ${prixM2(s.medianeM2)}. Ce bien est à ${pourcentageSigne(ecart)}.`;
}
