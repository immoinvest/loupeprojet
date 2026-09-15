import type { Cle, ProvenanceValeurs, Valeurs } from '@/ecrans/formulaire/valeurs';
import { pourcentage } from '@/formatage/nombres';

import { ITEMS, ORDRE_ITEMS, ORDRE_PRECISER, type Item } from './items';

/**
 * `essentiel` : visible en haut (ce qui manque parmi l'exigé, le loyer visé, le type de location non lu) ;
 * `lus` : ce que l'annonce a donné ; `estimes` : les défauts affichés ; `preciser` : le facultatif vide.
 */
export type NomGroupe = 'essentiel' | 'lus' | 'estimes' | 'preciser';
export type Groupes = Readonly<Record<NomGroupe, readonly Item[]>>;

const EXIGES: readonly Item[] = ['prix', 'surface', 'commune'];

/** Maison : ni étage, ni ascenseur, ni copropriété. */
export const MASQUES_MAISON: readonly Item[] = [
  'etage',
  'ascenseur',
  'chargesCoproMois',
  'lotsCopro',
  'coproEnProcedure',
];

/** Toutes les chaînes de l'item sont remplies ; la commune demande un code postal à cinq chiffres. */
export function estRenseigne(item: Item, v: Valeurs): boolean {
  if (item === 'commune') return /^\d{5}$/.test(v.codePostal.trim()) && v.ville.trim() !== '';
  return ITEMS[item].cles.every((cle) => v[cle].trim() !== '');
}

function origine(item: Item, p: ProvenanceValeurs): string | undefined {
  return ITEMS[item].cles.map((cle) => p[cle]).find((source) => source !== undefined);
}

/**
 * Le regroupement du formulaire, calculé une fois à l'ouverture : un champ ne change pas de groupe pendant
 * qu'on le remplit. Le loyer visé est toujours en tête (le chiffre qui change le plus le verdict).
 */
export function grouperChamps(v: Valeurs, p: ProvenanceValeurs): Groupes {
  const groupes: Record<NomGroupe, Item[]> = { essentiel: [], lus: [], estimes: [], preciser: [] };
  for (const item of ORDRE_ITEMS) {
    const source = origine(item, p);
    let groupe: NomGroupe;
    if (item === 'loyer') groupe = 'essentiel';
    else if (item === 'mode') groupe = source === 'annonce' ? 'lus' : 'essentiel';
    else if (EXIGES.includes(item) && !estRenseigne(item, v)) groupe = 'essentiel';
    else if (source === 'annonce') groupe = 'lus';
    else if (source === 'estime') groupe = 'estimes';
    else groupe = 'preciser';
    groupes[groupe].push(item);
  }
  // Un champ absent de l'ordre de l'influence passe après les autres.
  const rang = (item: Item): number => {
    const i = ORDRE_PRECISER.indexOf(item);
    return i === -1 ? ORDRE_PRECISER.length : i;
  };
  groupes.preciser.sort((a, b) => rang(a) - rang(b));
  return groupes;
}

/** Le champ ne s'applique pas : maison (étage, ascenseur, copropriété), rez-de-chaussée (ascenseur). */
export function estMasque(item: Item, v: Valeurs): boolean {
  if (v.typeBien === 'maison' && MASQUES_MAISON.includes(item)) return true;
  return item === 'ascenseur' && v.etage.trim() === '0';
}

export function itemsVisibles(items: readonly Item[], v: Valeurs): readonly Item[] {
  return items.filter((item) => !estMasque(item, v));
}

/** Les valeurs envoyées : un champ masqué ne compte pas, même rempli par l'annonce. */
export function sansValeursMasquees(v: Valeurs): Valeurs {
  const copie: Record<Cle, string> = { ...v };
  for (const item of ORDRE_ITEMS) {
    if (!estMasque(item, v)) continue;
    for (const cle of ITEMS[item].cles) copie[cle] = '';
  }
  return copie;
}

/**
 * La provenance envoyée avec les valeurs : celle d'un champ vidé parce que masqué disparaît ; celle d'un
 * champ déjà vide reste (l'apport « estimé » vide est calculé plus loin).
 */
export function provenanceEnvoyee(
  avant: Valeurs,
  envoyees: Valeurs,
  provenance: ProvenanceValeurs,
): ProvenanceValeurs {
  const garde: ProvenanceValeurs = {};
  for (const [cle, source] of Object.entries(provenance) as [Cle, ProvenanceValeurs[Cle]][]) {
    if (source !== undefined && (envoyees[cle] !== '' || avant[cle] === '')) garde[cle] = source;
  }
  return garde;
}

/** « 11 informations ». */
export function resumeLus(items: readonly Item[]): string {
  return `${String(items.length)} information${items.length > 1 ? 's' : ''}`;
}

/** « apport 10 %, 25 ans, tranche 30 % » ; `partApport` = part de l'apport dans le coût total si connue. */
export function resumeEstimes(
  items: readonly Item[],
  v: Valeurs,
  partApport: number | null,
): string {
  const avecValeur: Partial<Record<Item, () => string>> = {
    apport: () => (partApport === null ? 'apport' : `apport ${pourcentage(partApport, 0)}`),
    dureeAnnees: () => `${v.dureeAnnees} ans`,
    tmi: () => `tranche ${pourcentage(Number(v.tmi), 0)}`,
    chambres: () => `${v.chambres} chambre${v.chambres === '0' || v.chambres === '1' ? '' : 's'}`,
  };
  return items.map((item) => avecValeur[item]?.() ?? ITEMS[item].nom).join(', ');
}

/** « DPE, état, charges de copro, taxe foncière… » : les quatre premiers noms. */
export function resumePreciser(items: readonly Item[]): string {
  const noms = items.slice(0, 4).map((item) => ITEMS[item].nom);
  return `${noms.join(', ')}${items.length > 4 ? '…' : ''}`;
}

const NOMS_GROUPES: readonly NomGroupe[] = ['essentiel', 'lus', 'estimes', 'preciser'];

/** Le groupe qui contient un item ; `grouperChamps` range chaque item dans un groupe. */
export function groupeDeItem(groupes: Groupes, item: Item): NomGroupe {
  for (const nom of NOMS_GROUPES) if (groupes[nom].includes(item)) return nom;
  throw new Error(`${item} n'est rangé dans aucun groupe`);
}
