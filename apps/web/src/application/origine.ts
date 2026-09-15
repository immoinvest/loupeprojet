import { origineProduction } from '@loupe/capture/origines';

import { drapeauLeve } from './build';

/**
 * L'adresse de production figée au build (`DEKLIC_ORIGINE`, par vite.config.ts) : l'adresse historique
 * tant que Pierre n'a pas branché app.deklic.pro.
 */
export const ORIGINE_PRODUCTION = origineProduction(
  import.meta.env.DEKLIC_ORIGINE as string | undefined,
);

/** `DEKLIC_TRANSFERT=1` au build : l'ancienne adresse envoie ses projets et redirige vers la nouvelle. */
export const TRANSFERT_ACTIF = drapeauLeve(import.meta.env.DEKLIC_TRANSFERT as string | undefined);
