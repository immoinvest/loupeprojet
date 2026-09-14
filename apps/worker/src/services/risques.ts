import { z } from 'zod';

import { definirService } from './types';

/** Rapport de risques de Géorisques pour un point : https://georisques.gouv.fr/api/v1/resultats_rapport_risque?latlon=lon,lat */
export const URL_GEORISQUES = 'https://georisques.gouv.fr/api/v1/resultats_rapport_risque';

const ParametresSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

const RisqueAmontSchema = z.object({
  present: z.boolean(),
  libelle: z.string(),
  libelleStatutCommune: z.string().nullish(),
  libelleStatutAdresse: z.string().nullish(),
});

const ReponseGeorisquesSchema = z.object({
  url: z.string().nullish(),
  risquesNaturels: z.record(z.string(), RisqueAmontSchema),
  risquesTechnologiques: z.record(z.string(), RisqueAmontSchema),
});

export type NiveauRisque = 'fort' | 'moyen' | 'faible' | 'inconnu' | 'absent';

export interface RisqueAdresse {
  /** Clé Géorisques : `inondation`, `retraitGonflementArgile`, `pollutionSols`… */
  readonly code: string;
  readonly famille: 'naturel' | 'technologique';
  readonly libelle: string;
  readonly adresse: NiveauRisque;
  readonly commune: NiveauRisque;
}

export interface ReponseRisques {
  /** Rapport officiel à consulter. */
  readonly url: string | null;
  readonly risques: readonly RisqueAdresse[];
}

/**
 * Libellé de statut Géorisques → niveau : « Risque Existant - important » = fort, « - faible » = faible,
 * « - modéré », « Risque Existant » ou « Risque Concerne » = moyen, « Inconnu » / « non Connu » = inconnu,
 * « non Concerne » ou rien = absent.
 */
export function niveauDepuisStatut(statut: string | null | undefined): NiveauRisque {
  if (statut === null || statut === undefined) return 'absent';
  const s = statut.toLowerCase();
  if (s.includes('non concern')) return 'absent';
  if (s.includes('inconnu') || s.includes('non connu')) return 'inconnu';
  if (s.includes('important')) return 'fort';
  if (s.includes('faible')) return 'faible';
  if (s.includes('existant') || s.includes('concern')) return 'moyen';
  return 'inconnu';
}

type RisquesAmont = z.infer<typeof ReponseGeorisquesSchema>['risquesNaturels'];

function presents(famille: RisqueAdresse['famille'], risques: RisquesAmont): RisqueAdresse[] {
  return Object.entries(risques)
    .filter(([, r]) => r.present)
    .map(([code, r]) => ({
      code,
      famille,
      libelle: r.libelle,
      adresse: niveauDepuisStatut(r.libelleStatutAdresse),
      commune: niveauDepuisStatut(r.libelleStatutCommune),
    }));
}

export const risques = definirService({
  nom: 'risques',
  ttlSecondes: 30 * 24 * 3600,
  delaiMs: 8000,
  parametres: ParametresSchema,
  urlAmont: (p) => {
    const url = new URL(URL_GEORISQUES);
    url.searchParams.set('latlon', `${String(p.lon)},${String(p.lat)}`);
    return url;
  },
  reponseAmont: ReponseGeorisquesSchema,
  normaliser: (amont): ReponseRisques => ({
    url: amont.url ?? null,
    risques: [
      ...presents('naturel', amont.risquesNaturels),
      ...presents('technologique', amont.risquesTechnologiques),
    ],
  }),
});
