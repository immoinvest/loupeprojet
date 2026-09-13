import type { ClasseEnergie } from '@loupe/moteur';

/** Champs qu'on sait lire dans le texte d'une annonce, par règles. Absent = non trouvé. */
export interface ChampsExtraits {
  readonly prix?: number;
  readonly surface?: number;
  readonly pieces?: number;
  readonly chambres?: number;
  readonly etage?: number;
  readonly ascenseur?: boolean;
  readonly dpe?: ClasseEnergie;
  readonly codePostal?: string;
  readonly ville?: string;
  readonly annee?: number;
  readonly chargesCoproMois?: number;
  readonly taxeFonciere?: number;
  readonly honorairesAgence?: number;
  readonly meuble?: boolean;
}

const PRIX_MINIMUM = 20_000;

/** « 155 000 » ou « 155.000 » ou « 155 000 » (espace insécable) → 155000. `\s` couvre les espaces insécables. */
function montant(brut: string): number {
  return Number(brut.replace(/[\s.]/g, '').replace(',', '.'));
}

function entier(brut: string | undefined): number | undefined {
  return brut === undefined ? undefined : Number(brut);
}

function prix(texte: string): number | undefined {
  const montants = [...texte.matchAll(/(\d{1,3}(?:[\s.]\d{3})+|\d{5,7})\s*(?:€|euros?)/gi)]
    .map((m) => montant(String(m[1])))
    .filter((v) => v >= PRIX_MINIMUM);
  return montants.length === 0 ? undefined : Math.max(...montants);
}

function surface(texte: string): number | undefined {
  const m = /(\d{1,3}(?:[,.]\d{1,2})?)\s*m(?:²|2)(?![\p{L}])/u.exec(texte);
  return m?.[1] === undefined ? undefined : Number(m[1].replace(',', '.'));
}

function pieces(texte: string): number | undefined {
  const explicite = /(\d{1,2})\s*pi[èe]ces?/i.exec(texte)?.[1];
  const type = /\b[TF](\d)\b/.exec(texte)?.[1];
  return entier(explicite ?? type);
}

function etage(texte: string): number | undefined {
  if (/rez[-\s]de[-\s]chauss[ée]e|\bRDC\b/i.test(texte)) return 0;
  return entier(/(\d{1,2})\s*(?:er|e|ème|eme)\s*[ée]tage/i.exec(texte)?.[1]);
}

function ascenseur(texte: string): boolean | undefined {
  if (/sans\s+ascenseur/i.test(texte)) return false;
  return /ascenseur/i.test(texte) ? true : undefined;
}

const CLASSES: readonly ClasseEnergie[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

function dpe(texte: string): ClasseEnergie | undefined {
  const lettre = /(?:DPE|classe\s+(?:énergie|énergétique|energie))\s*:?\s*([A-G])(?![\p{L}])/iu
    .exec(texte)?.[1]
    ?.toUpperCase();
  return CLASSES.find((c) => c === lettre);
}

function localisation(texte: string): { codePostal?: string; ville?: string } {
  const apres = /\b(\d{5})\s+([\p{Lu}][\p{L}\d'’ -]{1,40}?)(?=[\s,.(]|$)/u.exec(texte);
  if (apres?.[1] !== undefined && apres[2] !== undefined) {
    return { codePostal: apres[1], ville: apres[2].trim() };
  }
  const avant = /([\p{Lu}][\p{L}\d'’ -]{1,40}?)\s*\((\d{5})\)/u.exec(texte);
  if (avant?.[2] !== undefined && avant[1] !== undefined) {
    return { codePostal: avant[2], ville: avant[1].trim() };
  }
  return {};
}

function annee(texte: string): number | undefined {
  return entier(
    /(?:construit|construction|bâti|immeuble|résidence)\D{0,25}?((?:18|19|20)\d\d)/i.exec(
      texte,
    )?.[1],
  );
}

function chargesCoproMois(texte: string): number | undefined {
  const m =
    /charges?[^.\n]{0,40}?(\d{2,4})\s*€\s*(?:\/|par)\s*mois/i.exec(texte) ??
    /(?<!\d)(\d{2,4})\s*€[^.\n]{0,15}?de\s+charges/i.exec(texte);
  return entier(m?.[1]);
}

function taxeFonciere(texte: string): number | undefined {
  const m = /taxe\s+fonci[èe]re[^.\n]{0,30}?(\d[\d\s]{1,6})\s*€/i.exec(texte);
  return m?.[1] === undefined ? undefined : montant(m[1]);
}

function honoraires(texte: string): number | undefined {
  const m = /honoraires[^.\n]{0,40}?(\d[\d\s]{2,7})\s*€/i.exec(texte);
  return m?.[1] === undefined ? undefined : montant(m[1]);
}

/** Extraction par règles : sans réseau, sans LLM. Chaque champ absent reste absent. */
export function extraireChamps(texte: string): ChampsExtraits {
  const bruts: Record<string, unknown> = {
    prix: prix(texte),
    surface: surface(texte),
    pieces: pieces(texte),
    chambres: entier(/(\d{1,2})\s*chambres?/i.exec(texte)?.[1]),
    etage: etage(texte),
    ascenseur: ascenseur(texte),
    dpe: dpe(texte),
    ...localisation(texte),
    annee: annee(texte),
    chargesCoproMois: chargesCoproMois(texte),
    taxeFonciere: taxeFonciere(texte),
    honorairesAgence: honoraires(texte),
    meuble: /meubl[ée]/i.test(texte) ? true : undefined,
  };
  const champs: Record<string, unknown> = {};
  for (const [cle, valeur] of Object.entries(bruts)) {
    if (valeur !== undefined) champs[cle] = valeur;
  }
  return champs;
}
