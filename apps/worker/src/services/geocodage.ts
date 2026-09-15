import { z } from 'zod';

import { definirService } from './types';

/**
 * Géocodage par la Géoplateforme (IGN), successeur de api-adresse.data.gouv.fr :
 * https://data.geopf.fr/geocodage/search?q=…&limit=…&postcode=…
 * Réponse GeoJSON : features[].geometry.coordinates = [lon, lat], features[].properties = BAN.
 */
const URL_GEOPLATEFORME = 'https://data.geopf.fr/geocodage/search';

const ParametresSchema = z.object({
  q: z.string().trim().min(3).max(200),
  limit: z.coerce.number().int().min(1).max(10).default(5),
  codePostal: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
});

const ReponseGeoplateformeSchema = z.object({
  features: z.array(
    z.object({
      geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
      properties: z.object({
        label: z.string(),
        score: z.number(),
        type: z.string(),
        id: z.string().optional(),
        postcode: z.string().optional(),
        citycode: z.string().optional(),
        city: z.string().optional(),
      }),
    }),
  ),
});

export type PrecisionGeocodage = 'adresse' | 'rue' | 'lieu_dit' | 'commune' | 'inconnue';

export const PRECISIONS: Readonly<Record<string, PrecisionGeocodage>> = {
  housenumber: 'adresse',
  street: 'rue',
  locality: 'lieu_dit',
  municipality: 'commune',
};

export interface ResultatGeocodage {
  readonly libelle: string;
  readonly score: number;
  readonly lat: number;
  readonly lon: number;
  readonly precision: PrecisionGeocodage;
  readonly cleBan: string | null;
  readonly codeInsee: string | null;
  readonly codePostal: string | null;
  readonly commune: string | null;
}

export interface ReponseGeocodage {
  readonly resultats: readonly ResultatGeocodage[];
}

export const geocodage = definirService({
  nom: 'geocodage',
  ttlSecondes: 24 * 3600,
  delaiMs: 5000,
  parametres: ParametresSchema,
  urlAmont: (p) => {
    const url = new URL(URL_GEOPLATEFORME);
    url.searchParams.set('q', p.q);
    url.searchParams.set('limit', String(p.limit));
    if (p.codePostal !== undefined) url.searchParams.set('postcode', p.codePostal);
    return url;
  },
  reponseAmont: ReponseGeoplateformeSchema,
  normaliser: (amont): ReponseGeocodage => ({
    resultats: amont.features.map((f) => ({
      libelle: f.properties.label,
      score: f.properties.score,
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      precision: PRECISIONS[f.properties.type] ?? 'inconnue',
      cleBan: f.properties.id ?? null,
      codeInsee: f.properties.citycode ?? null,
      codePostal: f.properties.postcode ?? null,
      commune: f.properties.city ?? null,
    })),
  }),
});
