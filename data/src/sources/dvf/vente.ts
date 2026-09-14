import { champ, type EnregistrementCsv } from '../../commun/csv.ts';
import { elementA } from '../../commun/listes.ts';
import type { Vente } from '../../schemas/dvf.ts';
import type { FiltresDvf } from './constantes.ts';

const NATURE_VENTE = 'Vente';
const CODE_MAISON = '1';
const CODE_APPARTEMENT = '2';
const CODE_LOCAL_COMMERCIAL = '4';
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

export interface VenteLocalisee {
  readonly codeCommune: string;
  readonly vente: Vente;
}

/** Motifs d'exclusion d'une mutation, comptés dans le journal pour suivre la qualité de la source. */
export const MOTIFS_EXCLUSION = [
  'nature',
  'prix',
  'local_commercial',
  'logements',
  'surface',
  'prix_m2',
  'date',
] as const;
export type MotifExclusion = (typeof MOTIFS_EXCLUSION)[number];

export type ResultatVente =
  | { readonly ok: true; readonly vente: VenteLocalisee }
  | { readonly ok: false; readonly motif: MotifExclusion };

function exclusion(motif: MotifExclusion): ResultatVente {
  return { ok: false, motif };
}

/** Une mutation sur plusieurs parcelles répète parfois la même ligne de local : on ne la compte qu'une fois. */
function dedoublonner(lignes: readonly EnregistrementCsv[]): EnregistrementCsv[] {
  const uniques = new Map<string, EnregistrementCsv>();
  for (const ligne of lignes) {
    uniques.set(JSON.stringify(ligne), ligne);
  }
  return [...uniques.values()];
}

function estLogement(ligne: EnregistrementCsv): boolean {
  const code = champ(ligne, 'code_type_local');
  return code === CODE_MAISON || code === CODE_APPARTEMENT;
}

function entierOuZero(texte: string): number {
  const valeur = Number.parseInt(texte, 10);
  return Number.isNaN(valeur) ? 0 : valeur;
}

function coordonnee(texte: string): number | null {
  return texte === '' ? null : Number(texte);
}

function texteOuNull(texte: string): string | null {
  const nettoye = texte.trim();
  return nettoye === '' ? null : nettoye;
}

function entierOuNull(texte: string): number | null {
  const valeur = Number.parseInt(texte, 10);
  return Number.isNaN(valeur) ? null : valeur;
}

const NUMEROS_LOTS = ['1', '2', '3', '4', '5'] as const;

/** Surface Carrez du logement : somme des lots de sa ligne qui en mentionnent une. */
function surfaceCarrez(ligne: EnregistrementCsv): number | null {
  let total = 0;
  for (const numero of NUMEROS_LOTS) {
    const surface = Number.parseFloat(champ(ligne, `lot${numero}_surface_carrez`));
    if (surface > 0) total += surface;
  }
  return total > 0 ? Math.round(total * 100) / 100 : null;
}

/**
 * Transforme une mutation en vente de logement, ou l'écarte avec un motif :
 * nature « Vente » seulement, une seule valeur foncière, aucun local commercial,
 * exactement un logement, surface et prix au m² plausibles.
 */
export function venteDepuisMutation(
  lignes: readonly EnregistrementCsv[],
  filtres: FiltresDvf,
): ResultatVente {
  const premiere = elementA(lignes, 0);
  if (champ(premiere, 'nature_mutation') !== NATURE_VENTE) {
    return exclusion('nature');
  }
  const valeurs = new Set(lignes.map((ligne) => champ(ligne, 'valeur_fonciere')));
  const prix = Number(champ(premiere, 'valeur_fonciere'));
  if (valeurs.size !== 1 || !(prix > 0)) {
    return exclusion('prix');
  }
  if (lignes.some((ligne) => champ(ligne, 'code_type_local') === CODE_LOCAL_COMMERCIAL)) {
    return exclusion('local_commercial');
  }
  const logements = dedoublonner(lignes.filter(estLogement));
  if (logements.length !== 1) {
    return exclusion('logements');
  }
  const logement = elementA(logements, 0);
  const surface = Number(champ(logement, 'surface_reelle_bati'));
  if (!(surface >= filtres.surfaceMinM2 && surface <= filtres.surfaceMaxM2)) {
    return exclusion('surface');
  }
  const prixM2 = prix / surface;
  if (prixM2 < filtres.prixM2Min || prixM2 > filtres.prixM2Max) {
    return exclusion('prix_m2');
  }
  const date = champ(logement, 'date_mutation');
  if (!DATE_ISO.test(date)) {
    return exclusion('date');
  }
  return {
    ok: true,
    vente: {
      codeCommune: champ(logement, 'code_commune'),
      vente: {
        date,
        prix,
        surface,
        type: champ(logement, 'code_type_local') === CODE_MAISON ? 'maison' : 'appartement',
        pieces: entierOuZero(champ(logement, 'nombre_pieces_principales')),
        lat: coordonnee(champ(logement, 'latitude')),
        lon: coordonnee(champ(logement, 'longitude')),
        idParcelle: texteOuNull(champ(logement, 'id_parcelle')),
        numero: entierOuNull(champ(logement, 'adresse_numero')),
        suffixe: texteOuNull(champ(logement, 'adresse_suffixe')),
        codeVoie: texteOuNull(champ(logement, 'adresse_code_voie')),
        voie: texteOuNull(champ(logement, 'adresse_nom_voie')),
        carrez: surfaceCarrez(logement),
      },
    },
  };
}
