import { appliquerReponse, preparerEnvoi } from '@loupe/projets';

import type { StockageProjets } from '../ProjetsContext';
import type { ClientProjets, CodeErreurSynchro, StatutSynchro } from './types';

/** Garde-fou : 40 échanges couvrent 200 projets et leurs suppressions ; au-delà, on s'arrête. */
export const TOURS_MAX = 40;

function statutDeLErreur(code: CodeErreurSynchro): StatutSynchro {
  if (code === 'non_connecte') return 'reconnexion';
  if (code === 'reseau') return 'hors_ligne';
  return 'indisponible';
}

/**
 * Un cycle complet pour le compte `compte` : envoyer par lots, appliquer chaque réponse à l'état
 * courant de l'appareil, lire les pages suivantes, jusqu'à ce qu'il ne reste rien. Si l'appareil change
 * de compte pendant le cycle, les réponses de l'ancien ne sont pas appliquées.
 */
export async function synchroniserTout(
  client: ClientProjets,
  stockage: Pick<StockageProjets, 'lire' | 'transformer'>,
  compte: string,
): Promise<StatutSynchro> {
  const refuses = new Set<string>();
  for (let tour = 0; tour < TOURS_MAX; tour += 1) {
    const etat = stockage.lire();
    if (etat.journal.compte !== compte) return 'local';
    const { changements, envoi } = preparerEnvoi(etat, refuses);
    const resultat = await client.synchroniser({ depuis: etat.journal.curseur, changements });
    if (!resultat.ok) return statutDeLErreur(resultat.code);
    const reponse = resultat.valeur;
    stockage.transformer((e) =>
      e.journal.compte === compte ? appliquerReponse(e, envoi, reponse) : e,
    );
    for (const id of reponse.refuses) refuses.add(id);
    const reste = preparerEnvoi(stockage.lire(), refuses).changements.length > 0;
    if (!reponse.suite && !reste) return refuses.size > 0 ? 'limite' : 'a_jour';
  }
  return 'indisponible';
}
