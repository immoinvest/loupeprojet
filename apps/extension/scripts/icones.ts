/**
 * Icônes de l'extension générées au build : la loupe du favicon du web (cercle + manche, indigo
 * ADR-004) dessinée pixel par pixel et encodée en PNG sans dépendance. Aucun binaire versionné.
 */
import { deflateSync } from 'node:zlib';

const INDIGO: readonly [number, number, number] = [79, 85, 216];
const VUE = 24; // même repère que apps/web/public/favicon.svg
const CENTRE = 10.5;
const RAYON = 6.5;
const MANCHE_DEBUT = 15.5;
const MANCHE_FIN = 21;

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

/** Distance d'un point au segment du manche (extrémités arrondies). */
function distanceAuManche(u: number, v: number): number {
  const dx = MANCHE_FIN - MANCHE_DEBUT;
  const t = Math.max(
    0,
    Math.min(1, ((u - MANCHE_DEBUT) * dx + (v - MANCHE_DEBUT) * dx) / (2 * dx * dx)),
  );
  const px = MANCHE_DEBUT + t * dx;
  const py = MANCHE_DEBUT + t * dx;
  return Math.hypot(u - px, v - py);
}

/** Opacité (0 à 1) du pixel (x, y) d'une icône de `taille` pixels, avec anticrénelage. */
function opacite(x: number, y: number, taille: number): number {
  const pixel = VUE / taille;
  const u = (x + 0.5) * pixel;
  const v = (y + 0.5) * pixel;
  const epaisseur = taille <= 32 ? 3.2 : 2.4;
  const distance = Math.min(
    Math.abs(Math.hypot(u - CENTRE, v - CENTRE) - RAYON),
    distanceAuManche(u, v),
  );
  return Math.max(0, Math.min(1, (epaisseur / 2 - distance) / pixel + 0.5));
}

/** PNG RGBA d'une icône carrée de `taille` pixels. */
export function icone(taille: number): Buffer {
  const largeurLigne = taille * 4 + 1;
  const lignes = Buffer.alloc(largeurLigne * taille);
  for (let y = 0; y < taille; y += 1) {
    lignes[y * largeurLigne] = 0; // filtre « None »
    for (let x = 0; x < taille; x += 1) {
      const position = y * largeurLigne + 1 + x * 4;
      lignes[position] = INDIGO[0];
      lignes[position + 1] = INDIGO[1];
      lignes[position + 2] = INDIGO[2];
      lignes[position + 3] = Math.round(opacite(x, y, taille) * 255);
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
