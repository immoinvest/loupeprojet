import type { RequeteSynchro } from '@loupe/projets';

import { messageDe } from '../erreurs';

/**
 * Les projets synchronisés d'un compte. `synchroniser` n'écrit et ne lit que les lignes de `userId`
 * et rend la réponse déjà sérialisée (`ReponseSynchro` en JSON) : le contenu des projets, validé à
 * l'écriture, n'est pas réanalysé à la lecture (10 ms de CPU par requête).
 */
export interface DepotProjets {
  synchroniser(userId: string, requete: RequeteSynchro): Promise<string>;
}

const TABLE_ABSENTE = 'no such table: projet';

/** La base n'a pas encore reçu la migration 0004 (production pas encore migrée). */
export function estTableProjetAbsente(erreur: unknown): boolean {
  return messageDe(erreur).includes(TABLE_ABSENTE);
}
