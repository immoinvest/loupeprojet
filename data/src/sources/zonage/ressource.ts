import { z } from 'zod';
import type { Contexte } from '../../commun/contexte.ts';
import { telechargerJson } from '../../commun/telechargement.ts';
import { API_JEU_ZONAGE, MARQUE_RESSOURCE_NATIONALE } from './constantes.ts';

const JeuDataGouvSchema = z.object({
  resources: z.array(
    z.object({
      title: z.string(),
      format: z.string().nullable(),
      url: z.url(),
      last_modified: z.string(),
    }),
  ),
});

/** URL du CSV national le plus récent, retrouvée dans les métadonnées data.gouv du jeu. */
export async function urlRessourceZonage(contexte: Contexte): Promise<string> {
  const jeu = JeuDataGouvSchema.parse(await telechargerJson(API_JEU_ZONAGE, contexte));
  const candidates = jeu.resources
    .filter(
      (ressource) =>
        ressource.format?.toLowerCase() === 'csv' &&
        ressource.title.toLowerCase().includes(MARQUE_RESSOURCE_NATIONALE),
    )
    .sort((a, b) => b.last_modified.localeCompare(a.last_modified));
  const retenue = candidates[0];
  if (retenue === undefined) {
    throw new Error('aucun CSV « ensemble des communes » dans le jeu zonage ABC de data.gouv');
  }
  contexte.journal.info('zonage : ressource retenue', {
    titre: retenue.title,
    modifieeLe: retenue.last_modified,
  });
  return retenue.url;
}
