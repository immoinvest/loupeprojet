import { z } from 'zod';

import { PRECISIONS, type PrecisionGeocodage } from './geocodage';
import { definirService } from './types';

/**
 * Suggestions d'adresse pendant la frappe, par la Géoplateforme (IGN) en mode autocomplétion :
 * https://data.geopf.fr/geocodage/search?q=…&autocomplete=1&index=address&limit=…&lat=…&lon=…&postcode=…
 * Une requête par pause de frappe : jamais en cache KV (quota d'écritures), limite de débit dédiée.
 */
export const URL_AUTOCOMPLETION = 'https://data.geopf.fr/geocodage/search';
export const LIMITE_SUGGESTIONS = 6;

const ParametresSchema = z
  .object({
    q: z.string().trim().min(3).max(200),
    limit: z.coerce.number().int().min(1).max(10).default(LIMITE_SUGGESTIONS),
    /** Biais de position : les adresses proches de ce point d'abord. */
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
    codePostal: z
      .string()
      .regex(/^\d{5}$/)
      .optional(),
  })
  .superRefine((p, ctx) => {
    if ((p.lat === undefined) !== (p.lon === undefined)) {
      ctx.addIssue({ code: 'custom', path: ['lat'], message: 'lat et lon ensemble' });
    }
  });

const ReponseGeoplateformeSchema = z.object({
  features: z.array(
    z.object({
      geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
      properties: z.object({
        label: z.string(),
        type: z.string(),
        id: z.string().optional(),
        housenumber: z.string().optional(),
        street: z.string().optional(),
        name: z.string().optional(),
        postcode: z.string().optional(),
        citycode: z.string().optional(),
        city: z.string().optional(),
      }),
    }),
  ),
});

export interface SuggestionAdresse {
  readonly libelle: string;
  readonly precision: PrecisionGeocodage;
  /** « 144 », « 9 bis » : le numéro tel que la BAN l'écrit ; `null` pour une rue ou un lieu-dit. */
  readonly numero: string | null;
  readonly rue: string | null;
  readonly codePostal: string | null;
  readonly commune: string | null;
  readonly codeInsee: string | null;
  readonly lat: number;
  readonly lon: number;
  readonly cleBan: string | null;
}

export interface ReponseSuggestions {
  readonly suggestions: readonly SuggestionAdresse[];
}

export const adresses = definirService({
  nom: 'adresses',
  ttlSecondes: 0,
  delaiMs: 4000,
  parametres: ParametresSchema,
  urlAmont: (p) => {
    const url = new URL(URL_AUTOCOMPLETION);
    url.searchParams.set('q', p.q);
    url.searchParams.set('autocomplete', '1');
    url.searchParams.set('index', 'address');
    url.searchParams.set('limit', String(p.limit));
    if (p.lat !== undefined && p.lon !== undefined) {
      url.searchParams.set('lat', String(p.lat));
      url.searchParams.set('lon', String(p.lon));
    }
    if (p.codePostal !== undefined) url.searchParams.set('postcode', p.codePostal);
    return url;
  },
  reponseAmont: ReponseGeoplateformeSchema,
  normaliser: (amont): ReponseSuggestions => ({
    // Une commune seule ne situe pas un bien : elle n'est pas proposée.
    suggestions: amont.features
      .filter((f) => f.properties.type !== 'municipality')
      .map((f) => {
        const precision = PRECISIONS[f.properties.type] ?? 'inconnue';
        return {
          libelle: f.properties.label,
          precision,
          numero: f.properties.housenumber ?? null,
          rue:
            f.properties.street ?? (precision === 'adresse' ? null : (f.properties.name ?? null)),
          codePostal: f.properties.postcode ?? null,
          commune: f.properties.city ?? null,
          codeInsee: f.properties.citycode ?? null,
          lon: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
          cleBan: f.properties.id ?? null,
        };
      }),
  }),
  // Le texte change à chaque frappe : aucune lecture ni écriture du cache.
  enCache: () => false,
});
