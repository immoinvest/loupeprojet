import { adresses } from './adresses';
import { communes } from './communes';
import { dpe } from './dpe';
import { geocodage } from './geocodage';
import { risques } from './risques';
import type { Service } from './types';

/** Les services amont autorisés, par nom d'URL : /proxy/geocodage. Tout autre nom est refusé. */
export const SERVICES: Readonly<Record<string, Service>> = {
  geocodage,
  dpe,
  risques,
  communes,
  adresses,
};

export { definirService, type Service } from './types';
export {
  LIMITE_SUGGESTIONS,
  URL_AUTOCOMPLETION,
  type ReponseSuggestions,
  type SuggestionAdresse,
} from './adresses';
export {
  LIMITE_RECHERCHE_NOM,
  URL_API_GEO_COMMUNES,
  type CommuneApiGeo,
  type ReponseCommunes,
} from './communes';
export {
  etageDepuisComplement,
  URL_ADEME,
  type DpeAdresse,
  type Lettre,
  type ReponseDpe,
} from './dpe';
export {
  type PrecisionGeocodage,
  type ReponseGeocodage,
  type ResultatGeocodage,
} from './geocodage';
export {
  niveauDepuisStatut,
  URL_GEORISQUES,
  type NiveauRisque,
  type ReponseRisques,
  type RisqueAdresse,
} from './risques';
