import { geocodage } from './geocodage';
import type { Service } from './types';

/** Les services amont autorisés, par nom d'URL : /proxy/geocodage. Tout autre nom est refusé. */
export const SERVICES: Readonly<Record<string, Service>> = {
  geocodage,
};

export { definirService, type Service } from './types';
export {
  type PrecisionGeocodage,
  type ReponseGeocodage,
  type ResultatGeocodage,
} from './geocodage';
