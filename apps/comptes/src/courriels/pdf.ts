/**
 * Un écrivain PDF minimal (ADR-G40) : une page A4, du texte en Helvetica et Helvetica-Bold (polices
 * standard, non embarquées, encodage WinAnsi) et des traits. Sortie en ASCII seul : sa longueur en
 * caractères est sa longueur en octets, ce qui rend la table xref exacte sans conversion.
 */

export const LARGEUR_A4 = 595.28;
export const HAUTEUR_A4 = 841.89;

/** Largeurs Helvetica (métriques AFM, millièmes de corps) des caractères 32 à 126. */
const LARGEURS: readonly number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const PREMIER = 32;
const LARGEUR_PAR_DEFAUT = 556;

/** Espaces insécables, fines et étroites de `Intl` (« 700 € ») : une espace simple en WinAnsi. */
const ESPACES: ReadonlySet<number> = new Set([0x00a0, 0x2007, 0x2009, 0x202f]);

/** Les caractères Unicode placés par WinAnsi entre 0x80 et 0x9f. */
const WIN_ANSI: ReadonlyMap<number, number> = new Map([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

/** L'octet WinAnsi d'un caractère ; « ? » pour ce que la police ne sait pas écrire. */
export function octetWinAnsi(caractere: string): number {
  const code = caractere.charCodeAt(0);
  if (ESPACES.has(code)) return 0x20;
  if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) return code;
  return WIN_ANSI.get(code) ?? 0x3f;
}

function largeurCaractere(caractere: string): number {
  const octet = octetWinAnsi(caractere);
  const directe = LARGEURS[octet - PREMIER];
  if (directe !== undefined) return directe;
  // Une lettre accentuée prend la largeur de sa lettre de base (é → e).
  const base = caractere.normalize('NFD').charCodeAt(0);
  return LARGEURS[base - PREMIER] ?? LARGEUR_PAR_DEFAUT;
}

/** Largeur d'un texte en points pour un corps donné. */
export function largeurTexte(texte: string, taille: number): number {
  let total = 0;
  for (const caractere of texte) total += largeurCaractere(caractere);
  return (total * taille) / 1000;
}

/** Coupe un texte en lignes qui tiennent dans `largeurMax` (un mot trop long reste seul sur sa ligne). */
export function couperTexte(texte: string, taille: number, largeurMax: number): string[] {
  const lignes: string[] = [];
  let courante = '';
  for (const mot of texte.split(' ').filter((m) => m !== '')) {
    const essai = courante === '' ? mot : `${courante} ${mot}`;
    if (courante !== '' && largeurTexte(essai, taille) > largeurMax) {
      lignes.push(courante);
      courante = mot;
    } else {
      courante = essai;
    }
  }
  if (courante !== '') lignes.push(courante);
  return lignes;
}

const PARENTHESE_OUVRANTE = 0x28;
const PARENTHESE_FERMANTE = 0x29;
const BARRE_INVERSE = 0x5c;

/** Une chaîne littérale PDF : parenthèses et barre inverse échappées, octets hauts en octal. */
export function chainePdf(texte: string): string {
  let sortie = '(';
  for (const caractere of texte) {
    const octet = octetWinAnsi(caractere);
    if (octet === PARENTHESE_OUVRANTE || octet === PARENTHESE_FERMANTE || octet === BARRE_INVERSE) {
      sortie += `\\${String.fromCharCode(octet)}`;
    } else if (octet > 0x7e) {
      sortie += `\\${octet.toString(8).padStart(3, '0')}`;
    } else {
      sortie += String.fromCharCode(octet);
    }
  }
  return `${sortie})`;
}

export interface TextePdf {
  readonly texte: string;
  readonly x: number;
  /** Ligne de base, depuis le bas de la page. */
  readonly y: number;
  readonly taille: number;
  readonly gras?: boolean;
  /** `x` est le bord droit du texte. */
  readonly aDroite?: boolean;
}

export interface TraitPdf {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface PagePdf {
  readonly textes: readonly TextePdf[];
  readonly traits: readonly TraitPdf[];
}

function nombre(valeur: number): string {
  return String(Math.round(valeur * 100) / 100);
}

function flux(page: PagePdf): string {
  const operations = page.traits.map(
    (t) => `0.8 G 0.6 w ${nombre(t.x1)} ${nombre(t.y1)} m ${nombre(t.x2)} ${nombre(t.y2)} l S`,
  );
  for (const t of page.textes) {
    const x = t.aDroite === true ? t.x - largeurTexte(t.texte, t.taille) : t.x;
    const police = t.gras === true ? 'F2' : 'F1';
    operations.push(
      `BT /${police} ${nombre(t.taille)} Tf ${nombre(x)} ${nombre(t.y)} Td ${chainePdf(t.texte)} Tj ET`,
    );
  }
  return operations.join('\n');
}

/** Le fichier PDF complet, en ASCII. */
export function ecrirePdf(page: PagePdf): string {
  const contenu = flux(page);
  const objets = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${nombre(LARGEUR_A4)} ${nombre(HAUTEUR_A4)}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${String(contenu.length)} >>\nstream\n${contenu}\nendstream`,
  ];
  let sortie = '%PDF-1.4\n';
  const positions: number[] = [];
  objets.forEach((objet, rang) => {
    positions.push(sortie.length);
    sortie += `${String(rang + 1)} 0 obj\n${objet}\nendobj\n`;
  });
  const debutXref = sortie.length;
  sortie += `xref\n0 ${String(objets.length + 1)}\n0000000000 65535 f \n`;
  for (const position of positions) sortie += `${String(position).padStart(10, '0')} 00000 n \n`;
  sortie += `trailer\n<< /Size ${String(objets.length + 1)} /Root 1 0 R >>\nstartxref\n${String(debutXref)}\n%%EOF\n`;
  return sortie;
}
