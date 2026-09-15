import { z } from 'zod';

import { definirService } from './types';

/**
 * Communes de l'API Géo (DINUM) : https://geo.api.gouv.fr/communes?codePostal=…&fields=nom,code,codesPostaux
 * ou ?nom=…&boost=population. Une commune à arrondissements (Paris, Lyon, Marseille) est rendue entière :
 * l'application retrouve l'arrondissement par le code postal.
 */
export const URL_API_GEO_COMMUNES = 'https://geo.api.gouv.fr/communes';

/** Suggestions rendues pour une recherche par nom. */
export const LIMITE_RECHERCHE_NOM = 10;

const ParametresSchema = z
  .object({
    codePostal: z
      .string()
      .regex(/^\d{5}$/)
      .optional(),
    nom: z.string().trim().min(2).max(60).optional(),
  })
  .superRefine((p, ctx) => {
    // Exactement l'un des deux : un code postal, ou un début de nom.
    if ((p.codePostal === undefined) === (p.nom === undefined)) {
      ctx.addIssue({ code: 'custom', path: ['codePostal'], message: 'codePostal ou nom' });
    }
  });

const ReponseApiGeoSchema = z.array(
  z.object({
    nom: z.string(),
    code: z.string(),
    codesPostaux: z.array(z.string()).default([]),
  }),
);

export interface CommuneApiGeo {
  readonly nom: string;
  readonly codeInsee: string;
  readonly codesPostaux: readonly string[];
}

export interface ReponseCommunes {
  readonly communes: readonly CommuneApiGeo[];
}

export const communes = definirService({
  nom: 'communes',
  // Un code postal ne change quasiment jamais.
  ttlSecondes: 30 * 24 * 3600,
  delaiMs: 5000,
  parametres: ParametresSchema,
  urlAmont: (p) => {
    const url = new URL(URL_API_GEO_COMMUNES);
    if (p.codePostal !== undefined) url.searchParams.set('codePostal', p.codePostal);
    else {
      // Sans code postal, le schéma garantit un nom.
      url.searchParams.set('nom', String(p.nom));
      url.searchParams.set('boost', 'population');
      url.searchParams.set('limit', String(LIMITE_RECHERCHE_NOM));
    }
    url.searchParams.set('fields', 'nom,code,codesPostaux');
    url.searchParams.set('format', 'json');
    return url;
  },
  reponseAmont: ReponseApiGeoSchema,
  normaliser: (amont): ReponseCommunes => ({
    communes: amont.map((c) => ({ nom: c.nom, codeInsee: c.code, codesPostaux: c.codesPostaux })),
  }),
  // Une écriture par code postal ; la recherche par nom change à chaque frappe : jamais en cache.
  enCache: (p) => p.codePostal !== undefined,
});
