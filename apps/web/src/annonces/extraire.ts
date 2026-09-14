import type { ClasseEnergie, EtatBien, ModeLocation, TypeBien } from '@loupe/moteur';

/**
 * Champs lus dans une annonce (texte par règles, IA, ou données de la page lues par l'extension).
 * Absent = non trouvé. Type, GES, lots et procédure ne viennent que des données de la page.
 */
export interface ChampsExtraits {
  readonly typeBien?: TypeBien;
  readonly ges?: ClasseEnergie;
  readonly lotsCopro?: number;
  readonly coproEnProcedure?: boolean;
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
  readonly etat?: EtatBien;
  /** Balcon, terrasse ou loggia. */
  readonly exterieur?: boolean;
  /** Vendu loué : un locataire est en place à la vente. */
  readonly venduLoue?: boolean;
  /** Type de location que l'annonce décrit ou propose (colocation, « idéal Airbnb », bail mobilité…). */
  readonly mode?: ModeLocation;
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

/** Les mots des annonces, du plus défavorable au plus favorable : « à rénover » l'emporte sur « rénové ». */
function etat(texte: string): EtatBien | undefined {
  if (/(?:à|a)\s+r[ée]nover|travaux\s+(?:à|a)\s+pr[ée]voir|gros\s+travaux/i.test(texte)) {
    return 'a_renover';
  }
  if (/(?:à|a)\s+rafra[îi]chir/i.test(texte)) return 'a_rafraichir';
  if (/refait\s+(?:à|a)\s+neuf|r[ée]nov[ée](?:e|s|es)?(?![\p{L}])/iu.test(texte)) return 'renove';
  return /bon\s+[ée]tat/i.test(texte) ? 'bon_etat' : undefined;
}

function exterieur(texte: string): boolean | undefined {
  if (/sans\s+(?:balcon|terrasse|ext[ée]rieur)/i.test(texte)) return false;
  return /(?<![\p{L}])(?:balcons?|terrasses?|loggias?)(?![\p{L}])/iu.test(texte) ? true : undefined;
}

/** Une mention « libre » l'emporte : on ne décote pas un bien qui sera livré libre. */
function venduLoue(texte: string): boolean | undefined {
  if (
    /(?:vendu|livr[ée]|libre)\s+(?:libre|[àa]\s+la\s+vente|de\s+tout(?:e)?\s+occup)/i.test(texte)
  ) {
    return false;
  }
  return /vendu\s+lou[ée]|vente\s+occup[ée]e|locataires?\s+en\s+place|bail\s+en\s+cours|actuellement\s+lou[ée]/i.test(
    texte,
  )
    ? true
    : undefined;
}

/** Le type de location, du plus précis au plus général : « colocation » l'emporte sur « meublé ». */
function typeLocation(texte: string): ModeLocation | undefined {
  if (/colocation|coloc(?![\p{L}])/iu.test(texte)) return 'colocation';
  if (/bail\s+mobilit[ée]|moyenne\s+dur[ée]e/i.test(texte)) return 'moyenne_duree';
  if (
    /airbnb|saisonni[eè]re?|meubl[ée]\s+de\s+tourisme|courte\s+dur[ée]e|location\s+touristique/i.test(
      texte,
    )
  ) {
    return 'courte_duree';
  }
  return /meubl[ée]/i.test(texte) ? 'meuble' : undefined;
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
    etat: etat(texte),
    exterieur: exterieur(texte),
    venduLoue: venduLoue(texte),
    mode: typeLocation(texte),
  };
  const champs: Record<string, unknown> = {};
  for (const [cle, valeur] of Object.entries(bruts)) {
    if (valeur !== undefined) champs[cle] = valeur;
  }
  return champs;
}
