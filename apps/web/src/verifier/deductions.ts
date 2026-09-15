import { apportPourPart } from '@/annonces/apport';
import type { ProvenanceValeurs, ValeursInitiales, Valeurs } from '@/ecrans/formulaire/valeurs';

/** Les tuiles de l'apport : une part du coût total, ou « Autre » (montant saisi). */
export type ChoixApport = '0' | '0.1' | '0.2' | 'autre';

/** Une part du coût total proposée en tuile. */
export type PartApport = Exclude<ChoixApport, 'autre'>;

export const PARTS_APPORT: readonly PartApport[] = ['0', '0.1', '0.2'];

function entier(texte: string): number | null {
  return /^\s*\d+\s*$/.test(texte) ? Number(texte) : null;
}

/**
 * Chambres = pièces − 1, marquées « estimé », tant que personne ne les a données (ni l'annonce ni la
 * personne). Pièces effacées : les chambres estimées s'effacent aussi.
 */
export function avecChambresEstimees(v: Valeurs, p: ProvenanceValeurs): ValeursInitiales {
  if (p.chambres === 'annonce' || p.chambres === 'utilisateur')
    return { valeurs: v, provenance: p };
  const pieces = entier(v.pieces);
  if (pieces === null) {
    const sansChambres: ProvenanceValeurs = { ...p };
    delete sansChambres.chambres;
    return { valeurs: { ...v, chambres: '' }, provenance: sansChambres };
  }
  return {
    valeurs: { ...v, chambres: String(Math.max(0, pieces - 1)) },
    provenance: { ...p, chambres: 'estime' },
  };
}

/**
 * La tuile cochée pour un apport : 10 % tant qu'il est estimé (ou vide, le défaut s'applique), 0 % pour
 * zéro, 10 % ou 20 % quand le montant vaut exactement cette part arrondie ; « Autre » sinon.
 */
export function choixApport(texte: string, estime: boolean, coutTotal: number | null): ChoixApport {
  if (estime) return '0.1';
  const brut = texte.replace(/\s/g, '').replace(',', '.');
  if (brut === '') return '0.1';
  const montant = Number(brut);
  if (montant === 0) return '0';
  if (coutTotal !== null) {
    if (montant === apportPourPart(coutTotal, 0.1)) return '0.1';
    if (montant === apportPourPart(coutTotal, 0.2)) return '0.2';
  }
  return 'autre';
}
