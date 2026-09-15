import type { PartageCree } from '@loupe/projets';

import { messageDe } from '../erreurs';

/** Le contenu d'un lien ouvert : le projet déjà sérialisé et la nouvelle date d'expiration. */
export interface PartageOuvert {
  readonly contenu: string;
  readonly expireLe: string;
}

/**
 * Les liens de partage courts (ADR-009). `contenu` est la sérialisation d'un projet déjà validé ;
 * `ip` ne sert qu'à la limite de débit et n'est gardée qu'en empreinte salée.
 */
export interface DepotPartages {
  /** Crée un lien, ou `'limite'` si cette adresse IP en a déjà créé trop dans l'heure. */
  creer(contenu: string, ip: string): Promise<PartageCree | 'limite'>;
  /** Le lien s'il existe et n'a pas expiré ; son expiration repart pour 90 jours. */
  lire(id: string): Promise<PartageOuvert | null>;
  /** Supprime le lien si le jeton est le bon ; `false` sinon (inconnu, déjà supprimé, mauvais jeton). */
  supprimer(id: string, jeton: string): Promise<boolean>;
}

const TABLE_ABSENTE = 'no such table: partage';

/** La base n'a pas encore reçu la migration 0006 (production pas encore migrée). */
export function estTablePartageAbsente(erreur: unknown): boolean {
  return messageDe(erreur).includes(TABLE_ABSENTE);
}
