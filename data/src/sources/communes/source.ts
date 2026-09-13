import { join } from 'node:path';
import type { Contexte } from '../../commun/contexte.ts';
import { dateIso } from '../../commun/dates.ts';
import { ecrireJson } from '../../commun/fichiers.ts';
import { objetTrie } from '../../commun/listes.ts';
import { telechargerJson } from '../../commun/telechargement.ts';
import { CommunesDepartementSchema } from '../../schemas/communes.ts';
import {
  COMMUNES_A_ARRONDISSEMENTS,
  SOURCE_COMMUNES,
  urlArrondissements,
  urlCommunes,
} from './constantes.ts';
import { ReponseCommunesSchema, communesDepuisApi, type Arrondissements } from './transformer.ts';

export interface OptionsCommunes {
  readonly departements: readonly string[];
}

async function lireArrondissements(
  contexte: Contexte,
  departement: string,
): Promise<Arrondissements | null> {
  const communeParente = COMMUNES_A_ARRONDISSEMENTS[departement];
  if (communeParente === undefined) {
    return null;
  }
  const liste = ReponseCommunesSchema.parse(
    await telechargerJson(urlArrondissements(departement), contexte),
  );
  return { communeParente, liste };
}

/** Communes par département depuis l'API Géo : nom, codes postaux, population, EPCI, arrondissements municipaux. */
export async function executerCommunes(
  contexte: Contexte,
  options: OptionsCommunes,
): Promise<void> {
  for (const departement of options.departements) {
    const communes = ReponseCommunesSchema.parse(
      await telechargerJson(urlCommunes(departement), contexte),
    );
    const arrondissements = await lireArrondissements(contexte, departement);
    const maintenant = contexte.horloge();
    const fichier = CommunesDepartementSchema.parse({
      genereLe: maintenant.toISOString(),
      millesime: dateIso(maintenant),
      source: SOURCE_COMMUNES,
      departement,
      communes: objetTrie(communesDepuisApi(communes, arrondissements)),
    });
    await ecrireJson(join(contexte.dossierSortie, 'communes', `${departement}.json`), fichier);
    contexte.journal.info('communes : département publié', {
      departement,
      communes: communes.length,
      arrondissements: arrondissements?.liste.length ?? 0,
    });
  }
}
