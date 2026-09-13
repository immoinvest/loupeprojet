import { z } from 'zod';
import type { Contexte } from '../../commun/contexte.ts';
import { telechargerJson } from '../../commun/telechargement.ts';
import { urlAnneesRei } from './constantes.ts';

const FacettesSchema = z.object({
  facets: z.array(
    z.object({
      name: z.string(),
      facets: z.array(z.object({ name: z.string() })),
    }),
  ),
});

/** Dernier exercice disponible dans le jeu REI de l'OFGL (facette `annee`). */
export async function detecterAnneeRei(contexte: Contexte): Promise<string> {
  const facettes = FacettesSchema.parse(await telechargerJson(urlAnneesRei(), contexte));
  const annees = facettes.facets
    .filter((facette) => facette.name === 'annee')
    .flatMap((facette) => facette.facets.map((valeur) => valeur.name))
    .filter((annee) => /^\d{4}$/.test(annee))
    .sort();
  const derniere = annees.at(-1);
  if (derniere === undefined) {
    throw new Error('aucun exercice trouvé dans la facette annee du jeu REI');
  }
  return derniere;
}
