import type { ClasseEnergieCapture } from '../schema';

import type { TypeValeur } from './schema';

const CLASSES: readonly ClasseEnergieCapture[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

/** Espace fine insécable (U+202F), fréquente devant « € » et entre les milliers dans les pages françaises. */
const ESPACE_FINE = String.fromCharCode(0x20_2f);
const ESPACES_HORIZONTAUX = new RegExp(`[ \\t\\xA0${ESPACE_FINE}]+`, 'g');
const MONTANT = new RegExp(`\\d(?:[\\d .\\xA0${ESPACE_FINE}]*\\d)?(?:,\\d+)?`);
const SEPARATEURS_DE_MILLIERS = new RegExp(`[ .\\xA0${ESPACE_FINE}]`, 'g');

/** Espaces horizontaux (insécables compris) ramenés à un seul ; sauts de ligne conservés. */
export function normaliserTexte(brut: string): string {
  return brut
    .replace(ESPACES_HORIZONTAUX, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function versTexte(brut: unknown): string | undefined {
  if (typeof brut === 'string') {
    const t = normaliserTexte(brut);
    return t === '' ? undefined : t;
  }
  if (typeof brut === 'number' || typeof brut === 'boolean') return String(brut);
  return undefined;
}

/** « 155 000 EUR », « 155.000 », « 1 050,50 » : espaces et points séparent les milliers, la virgule est décimale. */
function versMontant(texte: string): number | undefined {
  const m = MONTANT.exec(texte);
  if (m === null) return undefined;
  return Number(m[0].replace(SEPARATEURS_DE_MILLIERS, '').replace(',', '.'));
}

/** « 65,5 m² », « 65.5 » → 65.5 : le premier nombre, virgule ou point décimal. */
function versNombre(texte: string): number | undefined {
  const m = /\d+(?:[.,]\d+)?/.exec(texte);
  return m === null ? undefined : Number(m[0].replace(',', '.'));
}

function versEntier(texte: string): number | undefined {
  const m = /\d+/.exec(texte);
  return m === null ? undefined : Number(m[0]);
}

function versEtage(texte: string): number | undefined {
  if (/rez[-\s]de[-\s]chauss|\bRDC\b/i.test(texte)) return 0;
  return versEntier(texte);
}

function versBooleen(brut: unknown, texte: string): boolean | undefined {
  if (typeof brut === 'boolean') return brut;
  if (/^(oui|yes|true|1)$/i.test(texte)) return true;
  if (/^(non|no|false|0)$/i.test(texte)) return false;
  return undefined;
}

/** « D », « d », « Classe D » → D ; une lettre isolée en minuscule au milieu d'un texte ne compte pas. */
function versClasse(texte: string): ClasseEnergieCapture | undefined {
  const m = /^\s*([A-G])\s*$/i.exec(texte) ?? /\b([A-G])\b/.exec(texte);
  const lettre = m === null ? undefined : String(m[1]).toUpperCase();
  return CLASSES.find((c) => c === lettre);
}

function versCodePostal(texte: string): string | undefined {
  return /(?<!\d)(\d{5})(?!\d)/.exec(texte)?.[1];
}

/** Applique `regex` au texte : groupe 1 s'il existe, sinon toute la correspondance ; `undefined` sans correspondance. */
export function appliquerRegex(texte: string, regex: string | undefined): string | undefined {
  if (regex === undefined) return texte;
  const m = new RegExp(regex, 'iu').exec(texte);
  if (m === null) return undefined;
  return m[1] ?? m[0];
}

/**
 * Valeur brute (chaîne, nombre, booléen, ou n'importe quoi d'autre) → valeur typée pour la capture,
 * ou `undefined` si rien d'exploitable. Ne lève jamais.
 */
export function convertir(
  brut: unknown,
  type: TypeValeur,
  options: { readonly regex?: string | undefined; readonly diviser?: number | undefined } = {},
): string | number | boolean | undefined {
  const texteBrut = versTexte(brut);
  if (texteBrut === undefined) return undefined;
  const texte = appliquerRegex(texteBrut, options.regex);
  if (texte === undefined) return undefined;
  const valeur = convertirTexte(brut, texte, type);
  if (typeof valeur === 'number' && options.diviser !== undefined) return valeur / options.diviser;
  return valeur;
}

function convertirTexte(
  brut: unknown,
  texte: string,
  type: TypeValeur,
): string | number | boolean | undefined {
  switch (type) {
    case 'texte':
      return texte;
    case 'montant':
      return typeof brut === 'number' ? brut : versMontant(texte);
    case 'nombre':
      return typeof brut === 'number' ? brut : versNombre(texte);
    case 'entier':
      return versEntier(texte);
    case 'etage':
      return versEtage(texte);
    case 'booleen':
      return versBooleen(brut, texte);
    case 'classe':
      return versClasse(texte);
    case 'codePostal':
      return versCodePostal(texte);
  }
}
