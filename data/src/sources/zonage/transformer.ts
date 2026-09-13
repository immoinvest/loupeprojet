import { champ, type EnregistrementCsv } from '../../commun/csv.ts';
import { elementA } from '../../commun/listes.ts';
import { ZoneAbcSchema, type ZoneAbc } from '../../schemas/zonage.ts';

export interface LigneZonage {
  readonly codeInsee: string;
  readonly departement: string;
  readonly zone: ZoneAbc;
}

const MOIS_FRANCAIS: Readonly<Record<string, string>> = {
  janvier: '01',
  février: '02',
  fevrier: '02',
  mars: '03',
  avril: '04',
  mai: '05',
  juin: '06',
  juillet: '07',
  août: '08',
  aout: '08',
  septembre: '09',
  octobre: '10',
  novembre: '11',
  décembre: '12',
  decembre: '12',
};

/** La colonne de zone s'appelle « Zonage ABC en vigueur depuis le … » : son nom change à chaque arrêté. */
export function colonneZone(colonnes: readonly string[]): string | undefined {
  return colonnes.find((colonne) => colonne.toLowerCase().startsWith('zonage'));
}

/** Date d'entrée en vigueur lue dans le nom de la colonne (« 26 juin 2026 » → 2026-06-26), null sinon. */
export function dateEnVigueur(nomColonne: string): string | null {
  const correspondance = /(\d{1,2})(?:er)?\s+([a-zéû]+)\s+(\d{4})/i.exec(nomColonne);
  if (correspondance === null) {
    return null;
  }
  const mois = MOIS_FRANCAIS[elementA(correspondance, 2).toLowerCase()];
  if (mois === undefined) {
    return null;
  }
  return `${elementA(correspondance, 3)}-${mois}-${elementA(correspondance, 1).padStart(2, '0')}`;
}

/** « A bis » et « Abis » désignent la même zone ; les espaces parasites sont retirés. */
export function normaliserZone(texte: string): string {
  return texte.replace(/\s+/g, '').replace(/^ABIS$/i, 'Abis');
}

export function zoneDepuisLigne(ligne: EnregistrementCsv, colonne: string): LigneZonage | null {
  const zone = ZoneAbcSchema.safeParse(normaliserZone(champ(ligne, colonne)));
  if (!zone.success) {
    return null;
  }
  return { codeInsee: champ(ligne, 'CODGEO'), departement: champ(ligne, 'DEP'), zone: zone.data };
}

export function regrouperParDepartement(
  lignes: Iterable<LigneZonage>,
): Map<string, Record<string, ZoneAbc>> {
  const resultat = new Map<string, Record<string, ZoneAbc>>();
  for (const ligne of lignes) {
    let communes = resultat.get(ligne.departement);
    if (communes === undefined) {
      communes = {};
      resultat.set(ligne.departement, communes);
    }
    communes[ligne.codeInsee] = ligne.zone;
  }
  return resultat;
}
