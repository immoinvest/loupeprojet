import type { Arguments, NomSource } from '../cli/arguments.ts';
import type { Contexte } from '../commun/contexte.ts';
import { executerCommunes } from './communes/source.ts';
import { executerDvf } from './dvf/source.ts';
import { executerLoyers } from './loyers/source.ts';
import { executerTaxeFonciere } from './taxe-fonciere/source.ts';
import { executerUsure } from './usure/source.ts';
import { executerZonage } from './zonage/source.ts';

export type Executeur = (contexte: Contexte, args: Arguments) => Promise<void>;

/** Adapte les arguments de la ligne de commande aux options de chaque source. */
export const EXECUTEURS: Readonly<Record<NomSource, Executeur>> = {
  dvf: (contexte, args) =>
    executerDvf(contexte, {
      departements: args.departements,
      passeComplete: args.passeComplete,
      ...(args.millesimeDvf === undefined ? {} : { millesime: args.millesimeDvf }),
    }),
  loyers: (contexte, args) => executerLoyers(contexte, { departements: args.departements }),
  'taxe-fonciere': (contexte, args) =>
    executerTaxeFonciere(contexte, {
      departements: args.departements,
      ...(args.anneeRei === undefined ? {} : { annee: args.anneeRei }),
    }),
  zonage: (contexte, args) => executerZonage(contexte, { departements: args.departements }),
  usure: (contexte) => executerUsure(contexte, {}),
  communes: (contexte, args) => executerCommunes(contexte, { departements: args.departements }),
};

/** Exécute les sources demandées dans l'ordre, en journalisant début, fin et durée de chacune. */
export async function executerSources(
  contexte: Contexte,
  args: Arguments,
  executeurs: Readonly<Record<NomSource, Executeur>>,
): Promise<void> {
  for (const nom of args.sources) {
    const debut = contexte.horloge().getTime();
    contexte.journal.info('source : début', {
      source: nom,
      departements: args.departements.length,
      passeComplete: args.passeComplete,
    });
    await executeurs[nom](contexte, args);
    contexte.journal.info('source : terminée', {
      source: nom,
      dureeSecondes: Math.round((contexte.horloge().getTime() - debut) / 1000),
    });
  }
}
