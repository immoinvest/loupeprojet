import { departementDuCodePostal } from '@/annonces/construire';
import type { AdresseBien } from '@/stockage/projets';

import { lireCleBan } from './adresse';
import type { AdresseDvf, SuggestionAdresse } from './contrat';

/**
 * Suggestions d'adresse de l'onglet Estimation : adresses de la BAN pendant la frappe, complétées par les
 * adresses du cadastre (ventes DVF) quand la BAN ne peut pas les connaître — numéros fiscaux 9xxx,
 * résidences et cités. Choisir une suggestion construit directement l'adresse analysée.
 */

/** Au-dessous, trop de réponses pour être utiles : aucune requête. */
export const LONGUEUR_MIN_SUGGESTIONS = 3;
/** Les numéros de 9000 à 9999 sont des numéros fictifs attribués par la DGFiP, absents de la BAN. */
export const NUMERO_FISCAL_MIN = 9000;
/** Suggestions affichées au plus : la BAN en rend six, le cadastre quelques-unes. */
export const MAX_OPTIONS_ADRESSE = 8;

/** La commune d'où viennent les adresses du cadastre, et ce qui s'en affiche. */
export interface LieuCadastre {
  readonly codeInsee: string;
  readonly codePostal: string | null;
  readonly commune: string | null;
}

/**
 * Ce que l'écran sait déjà du bien. Le projet enregistré ne garde pas sa commune : son département (déduit du
 * code postal à la création) et l'adresse déjà analysée.
 */
export interface ContexteAdresse {
  readonly departement: string;
  /** Adresse enregistrée : sa commune sert au cadastre, son point au biais des suggestions. */
  readonly adresse?: AdresseBien | undefined;
}

export type OptionAdresse =
  | { readonly source: 'ban'; readonly suggestion: SuggestionAdresse }
  | { readonly source: 'cadastre'; readonly adresse: AdresseDvf; readonly lieu: LieuCadastre };

const PRECISIONS_PROPOSEES: Readonly<Record<string, number>> = { adresse: 0, rue: 1, lieu_dit: 2 };

/** Mots d'un ensemble sans numéro de voirie : résidence, cité, lotissement… */
const MOTS_ENSEMBLE =
  /(^|[^a-z])(res|residence|cite|lotissement|lot|domaine|hameau|zac|batiment|bat|immeuble)([^a-z]|$)/;

const sansAccents = (texte: string): string =>
  texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export function doitSuggerer(texte: string): boolean {
  return texte.trim().length >= LONGUEUR_MIN_SUGGESTIONS;
}

/** Le premier numéro de voie tapé (un à quatre chiffres) ; un code postal n'en est pas un. */
export function numeroTape(texte: string): number | null {
  const trouve = /(?:^|\D)(\d{1,4})(?!\d)/.exec(texte);
  return trouve === null ? null : Number(trouve[1]);
}

export function estNumeroFiscal(numero: number | null): boolean {
  return numero !== null && numero >= NUMERO_FISCAL_MIN;
}

/** « 144 », « 144 bis », « 144B » → 144 ; rien de lisible → `null`. */
export function lireNumero(texte: string): number | null {
  const trouve = /^\s*(\d{1,5})\s*([a-z]{0,6})\s*$/i.exec(texte);
  return trouve === null ? null : Number(trouve[1]);
}

/**
 * Faut-il aussi chercher dans les adresses du cadastre ? Oui pour un numéro fiscal, un nom de résidence ou de
 * cité, ou un numéro tapé que la BAN ne connaît pas (elle n'a rendu que la rue).
 */
export function fautChercherAuCadastre(
  texte: string,
  suggestions: readonly SuggestionAdresse[],
): boolean {
  const numero = numeroTape(texte);
  if (estNumeroFiscal(numero) || MOTS_ENSEMBLE.test(sansAccents(texte))) return true;
  if (numero === null) return false;
  return !suggestions.some(
    (s) =>
      s.precision === 'adresse' && s.numero !== null && Number.parseInt(s.numero, 10) === numero,
  );
}

/** La commune du cadastre : celle de la première suggestion située, sinon celle de l'adresse enregistrée. */
export function lieuDuCadastre(
  suggestions: readonly SuggestionAdresse[],
  contexte: ContexteAdresse,
): LieuCadastre | null {
  const situee = suggestions.find((s) => s.codeInsee !== null);
  if (situee?.codeInsee != null) {
    return { codeInsee: situee.codeInsee, codePostal: situee.codePostal, commune: situee.commune };
  }
  const adresse = contexte.adresse;
  if (adresse === undefined) return null;
  return { codeInsee: adresse.codeInsee, codePostal: adresse.codePostal ?? null, commune: null };
}

/** Le code postal est-il dans ce département ? « 13005 » et « 13 », « 20000 » et « 2A », « 97400 » et « 974 ». */
export function dansLeDepartement(codePostal: string | null, departement: string): boolean {
  return codePostal !== null && departementDuCodePostal(codePostal) === departement;
}

/**
 * La liste proposée : adresses de la BAN (le département du projet d'abord ; numéro, puis rue, puis
 * lieu-dit), puis celles du cadastre. Les précisions inconnues ne situent pas le bien : écartées.
 */
export function optionsAdresse(
  ban: readonly SuggestionAdresse[],
  cadastre: readonly AdresseDvf[],
  lieu: LieuCadastre | null,
  departement: string,
): OptionAdresse[] {
  const deLaBan: OptionAdresse[] = ban
    .flatMap((s, i) => {
      const precision = PRECISIONS_PROPOSEES[s.precision];
      if (precision === undefined) return [];
      const proche = dansLeDepartement(s.codePostal, departement);
      return [{ s, i, rang: (proche ? 0 : 10) + precision }];
    })
    .sort((a, b) => a.rang - b.rang || a.i - b.i)
    .map(({ s }) => ({ source: 'ban', suggestion: s }));
  const duCadastre: OptionAdresse[] =
    lieu === null ? [] : cadastre.map((adresse) => ({ source: 'cadastre', adresse, lieu }));
  return [...deLaBan, ...duCadastre].slice(0, MAX_OPTIONS_ADRESSE);
}

export function cleOptionAdresse(option: OptionAdresse): string {
  if (option.source === 'ban') {
    return `ban-${option.suggestion.cleBan ?? option.suggestion.libelle}`;
  }
  const a = option.adresse;
  return `cadastre-${a.codeVoie}-${String(a.numero)}-${a.suffixe ?? ''}`;
}

const PETITS_MOTS = new Set(['d', 'de', 'des', 'du', 'l', 'la', 'le', 'les', 'et', 'en', 'sur']);

/** « 9001 CITE VALCROS » → « 9001 Cite Valcros » : les libellés du cadastre sont publiés sans accents. */
export function casseDeTitre(texte: string): string {
  return texte
    .toLowerCase()
    .split(/\s+/)
    .filter((mot) => mot !== '')
    .map((mot, i) =>
      i > 0 && PETITS_MOTS.has(mot) ? mot : `${mot.charAt(0).toUpperCase()}${mot.slice(1)}`,
    )
    .join(' ');
}

/** « 9001 Cite Valcros, 13090 Aix-en-Provence ». */
export function libelleCadastre(adresse: AdresseDvf, lieu: LieuCadastre): string {
  const commune = [lieu.codePostal, lieu.commune].filter((t): t is string => t !== null).join(' ');
  return commune === ''
    ? casseDeTitre(adresse.libelle)
    : `${casseDeTitre(adresse.libelle)}, ${commune}`;
}

const avecCodePostal = (codePostal: string | null): { codePostal?: string } =>
  codePostal !== null && /^\d{5}$/.test(codePostal) ? { codePostal } : {};

/** Une suggestion avec numéro devient l'adresse analysée ; `null` sans commune (rien à analyser). */
export function adresseDepuisSuggestion(suggestion: SuggestionAdresse): AdresseBien | null {
  if (suggestion.codeInsee === null) return null;
  const voie = lireCleBan(suggestion.cleBan);
  return {
    libelle: suggestion.libelle,
    lat: suggestion.lat,
    lon: suggestion.lon,
    codeInsee: suggestion.codeInsee,
    codeVoie: voie?.codeVoie ?? null,
    numero: voie?.numero ?? null,
    ...avecCodePostal(suggestion.codePostal),
  };
}

/** Une rue choisie sans numéro : au point de la rue, avec le numéro donné ou sans. */
export function adresseDeRue(
  suggestion: SuggestionAdresse,
  numero: number | null,
): AdresseBien | null {
  const adresse = adresseDepuisSuggestion(suggestion);
  if (adresse === null) return null;
  return {
    ...adresse,
    libelle: numero === null ? suggestion.libelle : `${String(numero)} ${suggestion.libelle}`,
    numero,
  };
}

/** Une adresse du cadastre : son numéro fiscal et son code de voie retrouvent les ventes de l'immeuble. */
export function adresseDepuisCadastre(adresse: AdresseDvf, lieu: LieuCadastre): AdresseBien {
  return {
    libelle: libelleCadastre(adresse, lieu),
    lat: adresse.lat,
    lon: adresse.lon,
    codeInsee: lieu.codeInsee,
    codeVoie: adresse.codeVoie,
    numero: adresse.numero,
    ...avecCodePostal(lieu.codePostal),
  };
}

/** Une rue ou un lieu-dit demande le numéro avant l'analyse ; une adresse ou le cadastre s'analysent tout de suite. */
export function demandeNumero(option: OptionAdresse): boolean {
  return option.source === 'ban' && option.suggestion.precision !== 'adresse';
}
