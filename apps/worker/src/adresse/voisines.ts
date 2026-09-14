import { z } from 'zod';

import type { Dependances } from '../dependances';
import { messageDe } from '../erreurs';
import { ecrireCache, lireCache } from '../http';
import { cleCache } from '../proxy/cache';
import type { Point } from './geometrie';

/** Commune (ou arrondissement) qui contient un point : https://geo.api.gouv.fr/communes?lat&lon */
export const URL_API_GEO = 'https://geo.api.gouv.fr/communes';
/** Le plus grand cercle de l'analyse d'adresse. */
export const RAYON_VOISINES_M = 300;
export const MAX_COMMUNES_VOISINES = 4;
/** Les limites communales changent rarement : 30 jours. */
export const TTL_COMMUNE_POINT_SECONDES = 30 * 24 * 3600;
const DELAI_API_GEO_MS = 5000;

/** Arrondissements municipaux de Paris (751xx), Lyon (6938x) et Marseille (132xx) : les DVF y sont indexées. */
const ARRONDISSEMENT = /^(751\d\d|6938\d|132\d\d)$/;

const ReponseApiGeoSchema = z.array(z.object({ code: z.string() }));
const EnCacheSchema = z.object({ code: z.string().nullable() });

export interface CommunesVoisines {
  readonly codes: readonly string[];
  /** Faux quand au moins un point n'a pas pu être situé : l'analyse n'est alors pas mise en cache. */
  readonly complet: boolean;
}

/** Huit points à `rayonMetres` du centre, tous les 45° à partir du nord. */
export function pointsAutour(centre: Point, rayonMetres: number): Point[] {
  const dLat = rayonMetres / 111_195;
  const dLon = rayonMetres / (111_195 * Math.cos((centre.lat * Math.PI) / 180));
  return [0, 45, 90, 135, 180, 225, 270, 315].map((degres) => {
    const angle = (degres * Math.PI) / 180;
    return { lat: centre.lat + dLat * Math.cos(angle), lon: centre.lon + dLon * Math.sin(angle) };
  });
}

type Situation = { readonly ok: true; readonly code: string | null } | { readonly ok: false };

async function communeAuPoint(
  deps: Dependances,
  point: Point,
  arrondissement: boolean,
): Promise<Situation> {
  const lat = Number(point.lat.toFixed(5));
  const lon = Number(point.lon.toFixed(5));
  const cle = await cleCache('commune-point', { version: 1, lat, lon, arrondissement });
  const enCache = await lireCache(deps, cle);
  if (enCache !== null) {
    const lecture = EnCacheSchema.safeParse(JSON.parse(enCache));
    if (lecture.success) return { ok: true, code: lecture.data.code };
  }
  const url = new URL(URL_API_GEO);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('fields', 'code');
  if (arrondissement) url.searchParams.set('type', 'arrondissement-municipal');
  let corps: unknown;
  try {
    const reponse = await deps.fetcher(url, {
      signal: AbortSignal.timeout(DELAI_API_GEO_MS),
      headers: { accept: 'application/json' },
    });
    if (!reponse.ok) {
      deps.journal.erreur('communes.erreur', { statutAmont: reponse.status });
      return { ok: false };
    }
    corps = await reponse.json();
  } catch (erreur) {
    deps.journal.erreur('communes.injoignable', { raison: messageDe(erreur) });
    return { ok: false };
  }
  const lecture = ReponseApiGeoSchema.safeParse(corps);
  if (!lecture.success) {
    deps.journal.erreur('communes.invalide', {});
    return { ok: false };
  }
  // Aucun résultat : le point tombe en mer ou hors de France.
  const code = lecture.data[0]?.code ?? null;
  await ecrireCache(deps, cle, JSON.stringify({ code }), TTL_COMMUNE_POINT_SECONDES);
  return { ok: true, code };
}

/**
 * Les communes (arrondissements à Paris, Lyon, Marseille) que touche le cercle de 300 m autour du bien,
 * hors la sienne : leurs ventes comptent aussi dans les cercles. Quatre au plus.
 */
export async function communesAutour(
  deps: Dependances,
  centre: Point,
  codeInsee: string,
): Promise<CommunesVoisines> {
  const arrondissement = ARRONDISSEMENT.test(codeInsee);
  const situations = await Promise.all(
    pointsAutour(centre, RAYON_VOISINES_M).map((p) => communeAuPoint(deps, p, arrondissement)),
  );
  const codes = new Set<string>();
  for (const s of situations) {
    if (s.ok && s.code !== null && s.code !== codeInsee) codes.add(s.code);
  }
  return {
    codes: [...codes].slice(0, MAX_COMMUNES_VOISINES),
    complet: situations.every((s) => s.ok),
  };
}
