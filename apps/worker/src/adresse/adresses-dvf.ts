import type { VenteDvf } from './ventes';

/**
 * Les adresses du cadastre d'une commune, lues dans ses ventes DVF. Elles comblent ce que la BAN ne connaît
 * pas : numéros fictifs de la DGFiP (`9001`, `9002`…) et voies « ensembles » à code `A…` (FANTOIR), comme
 * « 9001 CITE VALCROS » à Aix-en-Provence, où la Géoplateforme ne rend que « Route de Valcros ».
 */
export interface AdresseDvf {
  /** « 9001 CITE VALCROS », tel que publié (majuscules, sans accents). */
  readonly libelle: string;
  readonly numero: number;
  readonly suffixe: string | null;
  readonly codeVoie: string;
  readonly voie: string;
  readonly parcelles: readonly string[];
  /** Moyenne des points des ventes situées (le point publié est celui de la parcelle). */
  readonly lat: number;
  readonly lon: number;
  readonly ventes: number;
}

export interface RechercheAdresse {
  /** Le numéro tapé (un à quatre chiffres) ; `null` sans numéro. */
  readonly numero: number | null;
  /** Les mots qui désignent la voie, normalisés, sans mots vides ni types de voie. */
  readonly mots: readonly string[];
}

/** Abréviations de la DGFiP et de la saisie courante, ramenées à leur forme longue. */
const ABREVIATIONS: Readonly<Record<string, string>> = {
  ALL: 'ALLEE',
  AV: 'AVENUE',
  AVE: 'AVENUE',
  BD: 'BOULEVARD',
  BLD: 'BOULEVARD',
  CHE: 'CHEMIN',
  CHEM: 'CHEMIN',
  CRS: 'COURS',
  DOM: 'DOMAINE',
  DR: 'DOCTEUR',
  HAM: 'HAMEAU',
  IMP: 'IMPASSE',
  LOT: 'LOTISSEMENT',
  PL: 'PLACE',
  QUA: 'QUARTIER',
  R: 'RUE',
  RES: 'RESIDENCE',
  RTE: 'ROUTE',
  SQ: 'SQUARE',
  ST: 'SAINT',
  STE: 'SAINTE',
  TRA: 'TRAVERSE',
};

const MOTS_VIDES = new Set([
  'A',
  'AU',
  'AUX',
  'D',
  'DE',
  'DES',
  'DU',
  'EN',
  'ET',
  'L',
  'LA',
  'LE',
  'LES',
  'SOUS',
  'SUR',
]);

/** Types de voie : « route de Galice » doit trouver « RES DE GALICE », seul le nom compte. */
const TYPES_DE_VOIE = new Set([
  'ALLEE',
  'AVENUE',
  'BIS',
  'BOULEVARD',
  'CHEMIN',
  'CITE',
  'COURS',
  'DOMAINE',
  'HAMEAU',
  'IMPASSE',
  'LOTISSEMENT',
  'PLACE',
  'QUARTIER',
  'RESIDENCE',
  'ROUTE',
  'RUE',
  'SQUARE',
  'TER',
  'TRAVERSE',
]);

/** Majuscules, sans accents, ponctuation en espaces, abréviations développées. */
export function normaliserTexte(texte: string): string[] {
  return texte
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((mot) => mot !== '')
    .map((mot) => ABREVIATIONS[mot] ?? mot);
}

/** Le numéro et les mots de la voie dans un texte tapé ; le code postal et la ville restent sans effet. */
export function lireRecherche(texte: string): RechercheAdresse {
  const jetons = normaliserTexte(texte);
  const numero = jetons.find((j) => /^\d{1,4}$/.test(j));
  const mots = jetons.filter((j) => !/\d/.test(j) && !MOTS_VIDES.has(j) && !TYPES_DE_VOIE.has(j));
  return { numero: numero === undefined ? null : Number(numero), mots: [...new Set(mots)] };
}

const arrondi = (valeur: number): number => Math.round(valeur * 1e6) / 1e6;

/**
 * Une adresse par numéro, suffixe, code de voie et voie : un même « 9001 » dans deux voies fait deux
 * adresses. Les ventes sans numéro, sans voie ou sans code de voie sont ignorées, comme les adresses dont
 * aucune vente n'est située (impossible d'analyser autour).
 */
export function regrouperAdresses(ventes: readonly VenteDvf[]): AdresseDvf[] {
  const groupes = new Map<string, { base: VenteDvf; ventes: VenteDvf[] }>();
  for (const vente of ventes) {
    if (vente.numero === null || vente.codeVoie === null || vente.voie === null) continue;
    const cle = [vente.numero, vente.suffixe ?? '', vente.codeVoie, vente.voie].join('|');
    const groupe = groupes.get(cle);
    if (groupe === undefined) groupes.set(cle, { base: vente, ventes: [vente] });
    else groupe.ventes.push(vente);
  }
  const adresses: AdresseDvf[] = [];
  for (const { base, ventes: liste } of groupes.values()) {
    const situees = liste.filter(
      (v): v is VenteDvf & { lat: number; lon: number } => v.lat !== null && v.lon !== null,
    );
    if (situees.length === 0) continue;
    const somme = situees.reduce((s, v) => ({ lat: s.lat + v.lat, lon: s.lon + v.lon }), {
      lat: 0,
      lon: 0,
    });
    const numero = Number(base.numero);
    const suffixe = base.suffixe;
    const voie = String(base.voie);
    adresses.push({
      libelle: `${String(numero)}${suffixe === null ? '' : ` ${suffixe}`} ${voie}`,
      numero,
      suffixe,
      codeVoie: String(base.codeVoie),
      voie,
      parcelles: [
        ...new Set(liste.map((v) => v.idParcelle).filter((p): p is string => p !== null)),
      ].sort(),
      lat: arrondi(somme.lat / situees.length),
      lon: arrondi(somme.lon / situees.length),
      ventes: liste.length,
    });
  }
  return adresses;
}

/** Nombre de mots de la recherche trouvés au début d'un mot de la voie (trois lettres suffisent). */
function motsTrouves(adresse: AdresseDvf, mots: readonly string[]): number {
  const motsVoie = normaliserTexte(adresse.voie);
  return mots.filter((mot) =>
    motsVoie.some((m) => m === mot || (mot.length >= 3 && m.startsWith(mot))),
  ).length;
}

/**
 * Les adresses qui répondent à la recherche : même numéro s'il est tapé, au moins un mot de la voie trouvé.
 * Les plus proches du texte d'abord, puis celles qui ont le plus de ventes.
 */
export function filtrerAdresses(
  adresses: readonly AdresseDvf[],
  recherche: RechercheAdresse,
  limite: number,
): AdresseDvf[] {
  if (recherche.mots.length === 0) return [];
  return adresses
    .filter((a) => recherche.numero === null || a.numero === recherche.numero)
    .map((adresse) => ({ adresse, score: motsTrouves(adresse, recherche.mots) }))
    .filter((r) => r.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.adresse.ventes - a.adresse.ventes ||
        a.adresse.libelle.localeCompare(b.adresse.libelle),
    )
    .slice(0, limite)
    .map((r) => r.adresse);
}
