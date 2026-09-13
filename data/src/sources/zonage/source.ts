import { join } from 'node:path';
import type { Contexte } from '../../commun/contexte.ts';
import { lireCsv } from '../../commun/csv.ts';
import { dateIso } from '../../commun/dates.ts';
import { ecrireJson } from '../../commun/fichiers.ts';
import { objetTrie } from '../../commun/listes.ts';
import { telechargerTexteEnFlux } from '../../commun/telechargement.ts';
import { ZonageDepartementSchema } from '../../schemas/zonage.ts';
import { SOURCE_ZONAGE } from './constantes.ts';
import { urlRessourceZonage } from './ressource.ts';
import {
  colonneZone,
  dateEnVigueur,
  regrouperParDepartement,
  zoneDepuisLigne,
  type LigneZonage,
} from './transformer.ts';

export interface OptionsZonage {
  readonly departements: readonly string[];
}

interface Lecture {
  readonly lignes: LigneZonage[];
  readonly millesime: string | null;
  readonly ignorees: number;
}

async function lireZonage(contexte: Contexte, url: string): Promise<Lecture> {
  const lignes: LigneZonage[] = [];
  let colonne: string | undefined;
  let millesime: string | null = null;
  let ignorees = 0;
  const texte = telechargerTexteEnFlux(url, contexte, { gzip: false, encodage: 'utf-8' });
  for await (const enregistrement of lireCsv(texte, { separateur: ';' })) {
    colonne ??= colonneZone(Object.keys(enregistrement));
    if (colonne === undefined) {
      throw new Error('zonage : aucune colonne « Zonage … » dans le CSV');
    }
    millesime ??= dateEnVigueur(colonne);
    const ligne = zoneDepuisLigne(enregistrement, colonne);
    if (ligne === null) {
      ignorees += 1;
    } else {
      lignes.push(ligne);
    }
  }
  return { lignes, millesime, ignorees };
}

/** Zonage ABC : le CSV national découpé en un JSON par département. */
export async function executerZonage(contexte: Contexte, options: OptionsZonage): Promise<void> {
  const url = await urlRessourceZonage(contexte);
  const lecture = await lireZonage(contexte, url);
  let millesime = lecture.millesime;
  if (millesime === null) {
    millesime = dateIso(contexte.horloge());
    contexte.journal.avertissement(
      'zonage : date d’entrée en vigueur introuvable, date du jour utilisée',
      {
        millesime,
      },
    );
  }
  contexte.journal.info('zonage : fichier lu', {
    communes: lecture.lignes.length,
    ignorees: lecture.ignorees,
    millesime,
  });
  const parDepartement = regrouperParDepartement(lecture.lignes);
  let publies = 0;
  for (const departement of options.departements) {
    const communes = parDepartement.get(departement);
    if (communes === undefined) {
      contexte.journal.avertissement('zonage : département absent de la source', { departement });
      continue;
    }
    const fichier = ZonageDepartementSchema.parse({
      genereLe: contexte.horloge().toISOString(),
      millesime,
      source: SOURCE_ZONAGE,
      departement,
      communes: objetTrie(communes),
    });
    await ecrireJson(join(contexte.dossierSortie, 'zonage', `${departement}.json`), fichier);
    publies += 1;
  }
  contexte.journal.info('zonage : départements publiés', { departements: publies });
}
