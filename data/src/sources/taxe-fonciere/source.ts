import { join } from 'node:path';
import type { Contexte } from '../../commun/contexte.ts';
import { lireCsv } from '../../commun/csv.ts';
import { ecrireJson } from '../../commun/fichiers.ts';
import { objetTrie } from '../../commun/listes.ts';
import { telechargerTexteEnFlux } from '../../commun/telechargement.ts';
import { TaxeFonciereDepartementSchema } from '../../schemas/taxe-fonciere.ts';
import { detecterAnneeRei } from './annee.ts';
import { SOURCE_TAXE_FONCIERE, urlExportRei } from './constantes.ts';
import { tauxDepuisLignes } from './transformer.ts';

export interface OptionsTaxeFonciere {
  readonly departements: readonly string[];
  /** Exercice REI (« 2025 ») ; détecté sur l'API si absent. */
  readonly annee?: string;
}

/** Taux de taxe foncière par commune : un JSON par département, depuis l'export filtré de l'OFGL. */
export async function executerTaxeFonciere(
  contexte: Contexte,
  options: OptionsTaxeFonciere,
): Promise<void> {
  const annee = options.annee ?? (await detecterAnneeRei(contexte));
  contexte.journal.info('taxe foncière : exercice REI retenu', { annee });
  for (const departement of options.departements) {
    const texte = telechargerTexteEnFlux(urlExportRei(departement, annee), contexte, {
      gzip: false,
      encodage: 'utf-8',
    });
    const communes = await tauxDepuisLignes(lireCsv(texte, { separateur: ';' }));
    const nombre = Object.keys(communes).length;
    if (nombre === 0) {
      contexte.journal.avertissement('taxe foncière : aucune commune dans l’export', {
        departement,
        annee,
      });
      continue;
    }
    const fichier = TaxeFonciereDepartementSchema.parse({
      genereLe: contexte.horloge().toISOString(),
      millesime: annee,
      source: SOURCE_TAXE_FONCIERE,
      departement,
      communes: objetTrie(communes),
    });
    await ecrireJson(
      join(contexte.dossierSortie, 'taxe-fonciere', annee, `${departement}.json`),
      fichier,
    );
    contexte.journal.info('taxe foncière : département publié', { departement, communes: nombre });
  }
}
