import { champ, type EnregistrementCsv } from '../../commun/csv.ts';

export interface Mutation {
  readonly id: string;
  readonly lignes: readonly EnregistrementCsv[];
  /** Vrai si cet identifiant avait déjà été rencontré plus haut : lignes non contiguës, mutation à écarter. */
  readonly rupture: boolean;
}

/**
 * Regroupe les lignes contiguës d'une même mutation (une ligne par local et par lot dans DVF).
 * Le fichier est parcouru en flux ; seul l'ensemble des identifiants déjà clos est gardé en mémoire.
 */
export async function* regrouperParMutation(
  lignes: AsyncIterable<EnregistrementCsv>,
): AsyncGenerator<Mutation> {
  const closes = new Set<string>();
  let idCourant: string | undefined;
  let courante: EnregistrementCsv[] = [];
  for await (const ligne of lignes) {
    const id = champ(ligne, 'id_mutation');
    if (id === idCourant) {
      courante.push(ligne);
      continue;
    }
    if (idCourant !== undefined) {
      yield { id: idCourant, lignes: courante, rupture: closes.has(idCourant) };
      closes.add(idCourant);
    }
    idCourant = id;
    courante = [ligne];
  }
  if (idCourant !== undefined) {
    yield { id: idCourant, lignes: courante, rupture: closes.has(idCourant) };
  }
}
