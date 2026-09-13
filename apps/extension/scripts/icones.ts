/**
 * Icônes de l'extension générées au build : l'icône d'app Deklic (ADR-005, `marque/logo/deklic-icone-app.svg`),
 * maison blanche et trois éclats orange sur un carré bleu arrondi, dessinée pixel par pixel sur la grille
 * de 64 de la marque et encodée en PNG sans dépendance. Aucun binaire versionné.
 */
import { deflateSync } from 'node:zlib';

type Couleur = readonly [number, number, number];

const BLEU: Couleur = [43, 75, 242];
const ORANGE: Couleur = [255, 122, 26];
const BLANC: Couleur = [255, 255, 255];

const GRILLE = 64;
const RAYON_CARRE = 14;
/** Maison : contour 4, jointures arrondies. */
const MAISON: readonly (readonly [number, number])[] = [
  [32, 22],
  [50, 36],
  [50, 56],
  [14, 56],
  [14, 36],
];
const EPAISSEUR_MAISON = 4;
/** Éclats : trait 5, bouts arrondis. */
const ECLATS: readonly (readonly [readonly [number, number], readonly [number, number]])[] = [
  [
    [32, 16],
    [32, 6],
  ],
  [
    [21, 19],
    [14, 12],
  ],
  [
    [43, 19],
    [50, 12],
  ],
];
const EPAISSEUR_ECLATS = 5;

const TABLE_CRC = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xed_b8_83_20 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(octets: Uint8Array): number {
  let c = 0xff_ff_ff_ff;
  for (const octet of octets) c = (TABLE_CRC[(c ^ octet) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xff_ff_ff_ff) >>> 0;
}

function bloc(type: string, donnees: Uint8Array): Buffer {
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length);
  const typeEtDonnees = Buffer.concat([Buffer.from(type, 'ascii'), donnees]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeEtDonnees));
  return Buffer.concat([longueur, typeEtDonnees, crc]);
}

function distanceSegment(
  px: number,
  py: number,
  [ax, ay]: readonly [number, number],
  [bx, by]: readonly [number, number],
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distanceMaison(px: number, py: number): number {
  let d = Number.POSITIVE_INFINITY;
  for (let i = 0; i < MAISON.length; i += 1) {
    const a = MAISON[i];
    const b = MAISON[(i + 1) % MAISON.length];
    if (a !== undefined && b !== undefined) d = Math.min(d, distanceSegment(px, py, a, b));
  }
  return d;
}

function distanceEclats(px: number, py: number): number {
  return Math.min(...ECLATS.map(([a, b]) => distanceSegment(px, py, a, b)));
}

/** Distance signée au carré arrondi qui remplit la grille (négative à l'intérieur). */
function distanceCarreArrondi(px: number, py: number): number {
  const demi = GRILLE / 2 - RAYON_CARRE;
  const qx = Math.abs(px - GRILLE / 2) - demi;
  const qy = Math.abs(py - GRILLE / 2) - demi;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - RAYON_CARRE;
}

/** Couverture (0 à 1) d'un trait d'épaisseur donnée à cette distance, anticrénelée sur un pixel. */
function couverture(distance: number, epaisseur: number, pixel: number): number {
  return Math.max(0, Math.min(1, (epaisseur / 2 - distance) / pixel + 0.5));
}

interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/** Compose `dessus` (opacité `alpha`) sur `dessous`, en alpha non prémultiplié. */
function superposer(dessous: Rgba, dessus: Couleur, alpha: number): Rgba {
  const a = alpha + dessous.a * (1 - alpha);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const melange = (haut: number, bas: number): number =>
    (haut * alpha + bas * dessous.a * (1 - alpha)) / a;
  return {
    r: melange(dessus[0], dessous.r),
    g: melange(dessus[1], dessous.g),
    b: melange(dessus[2], dessous.b),
    a,
  };
}

function pixel(x: number, y: number, taille: number): Rgba {
  const unite = GRILLE / taille;
  const u = (x + 0.5) * unite;
  const v = (y + 0.5) * unite;
  const fond = superposer(
    { r: 0, g: 0, b: 0, a: 0 },
    BLEU,
    Math.max(0, Math.min(1, -distanceCarreArrondi(u, v) / unite + 0.5)),
  );
  const avecMaison = superposer(
    fond,
    BLANC,
    couverture(distanceMaison(u, v), EPAISSEUR_MAISON, unite),
  );
  return superposer(avecMaison, ORANGE, couverture(distanceEclats(u, v), EPAISSEUR_ECLATS, unite));
}

/** PNG RGBA d'une icône carrée de `taille` pixels. */
export function icone(taille: number): Buffer {
  const largeurLigne = taille * 4 + 1;
  const lignes = Buffer.alloc(largeurLigne * taille);
  for (let y = 0; y < taille; y += 1) {
    lignes[y * largeurLigne] = 0; // filtre « None »
    for (let x = 0; x < taille; x += 1) {
      const p = pixel(x, y, taille);
      const position = y * largeurLigne + 1 + x * 4;
      lignes[position] = Math.round(p.r);
      lignes[position + 1] = Math.round(p.g);
      lignes[position + 2] = Math.round(p.b);
      lignes[position + 3] = Math.round(p.a * 255);
    }
  }
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(taille, 0);
  entete.writeUInt32BE(taille, 4);
  entete[8] = 8; // 8 bits par canal
  entete[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc('IHDR', entete),
    bloc('IDAT', deflateSync(lignes)),
    bloc('IEND', Buffer.alloc(0)),
  ]);
}

export const TAILLES_ICONES: readonly number[] = [16, 32, 48, 128];
