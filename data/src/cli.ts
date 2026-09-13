/**
 * Point d'entrée : `npm run referentiels -w data -- --source <nom> [--departement 13]`.
 * Exclu de la couverture : l'analyse des arguments et l'exécution des sources sont testées à part.
 */
import { AIDE, ErreurArguments, analyserArguments } from './cli/arguments.ts';
import { contexteReel } from './commun/contexte.ts';
import { messageDe } from './commun/erreurs.ts';
import { EXECUTEURS, executerSources } from './sources/executer.ts';

async function principal(argv: readonly string[]): Promise<number> {
  let args;
  try {
    args = analyserArguments(argv);
  } catch (erreur) {
    if (erreur instanceof ErreurArguments) {
      process.stderr.write(`${erreur.message}\n\n${AIDE}\n`);
      return 2;
    }
    throw erreur;
  }
  if (args.aide) {
    process.stdout.write(`${AIDE}\n`);
    return 0;
  }
  const contexte = contexteReel(args.dossierSortie);
  try {
    await executerSources(contexte, args, EXECUTEURS);
    return 0;
  } catch (erreur) {
    contexte.journal.erreur('référentiels : échec', { cause: messageDe(erreur) });
    return 1;
  }
}

process.exitCode = await principal(process.argv.slice(2));
