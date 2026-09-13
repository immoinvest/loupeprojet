import { join } from 'node:path';
import type { Contexte } from '../../commun/contexte.ts';
import { lireCsv } from '../../commun/csv.ts';
import { ecrireJson } from '../../commun/fichiers.ts';
import { objetTrie } from '../../commun/listes.ts';
import { telechargerTexteEnFlux } from '../../commun/telechargement.ts';
import {
  LoyersDepartementSchema,
  TYPES_INDICATEUR_LOYER,
  type TypeIndicateurLoyer,
} from '../../schemas/loyers.ts';
import { FICHIERS_LOYERS, MILLESIME_LOYERS, SOURCE_LOYERS } from './constantes.ts';
import { assemblerLoyers, indicateurDepuisLigne, type LigneIndicateur } from './transformer.ts';

export interface OptionsLoyers {
  readonly departements: readonly string[];
}

async function lireFichier(
  contexte: Contexte,
  type: TypeIndicateurLoyer,
): Promise<LigneIndicateur[]> {
  const lignes: LigneIndicateur[] = [];
  let ignorees = 0;
  const texte = telechargerTexteEnFlux(FICHIERS_LOYERS[type], contexte, {
    gzip: false,
    encodage: 'windows-1252',
  });
  for await (const enregistrement of lireCsv(texte, { separateur: ';' })) {
    const ligne = indicateurDepuisLigne(enregistrement);
    if (ligne === null) {
      ignorees += 1;
    } else {
      lignes.push(ligne);
    }
  }
  contexte.journal.info('loyers : fichier lu', { type, communes: lignes.length, ignorees });
  return lignes;
}

/** Carte des loyers ANIL : un JSON par département, quatre indicateurs par commune. */
export async function executerLoyers(contexte: Contexte, options: OptionsLoyers): Promise<void> {
  const lignesParType = new Map<TypeIndicateurLoyer, LigneIndicateur[]>();
  for (const type of TYPES_INDICATEUR_LOYER) {
    lignesParType.set(type, await lireFichier(contexte, type));
  }
  const parDepartement = assemblerLoyers(lignesParType);
  let publies = 0;
  for (const departement of options.departements) {
    const communes = parDepartement.get(departement);
    if (communes === undefined) {
      contexte.journal.avertissement('loyers : département absent de la source', { departement });
      continue;
    }
    const fichier = LoyersDepartementSchema.parse({
      genereLe: contexte.horloge().toISOString(),
      millesime: MILLESIME_LOYERS,
      source: SOURCE_LOYERS,
      departement,
      communes: objetTrie(communes),
    });
    await ecrireJson(
      join(contexte.dossierSortie, 'loyers', MILLESIME_LOYERS, `${departement}.json`),
      fichier,
    );
    publies += 1;
  }
  contexte.journal.info('loyers : départements publiés', {
    departements: publies,
    millesime: MILLESIME_LOYERS,
  });
}
