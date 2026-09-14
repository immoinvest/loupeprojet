import { z } from 'zod';

import type { Fetcher } from '../dependances';

/** Bien'ici sert les données d'une annonce en JSON, sans protection anti-robot : pas besoin de Bright Data. */
export const URL_DONNEES_BIENICI = 'https://www.bienici.com/realEstateAd.json';
export const DELAI_BIENICI_MS = 10_000;
export const AGENT_DEKLIC = 'Deklic/1.0 (+https://loupeprojet.pages.dev)';

export type ReponseDonnees =
  | { readonly ok: true; readonly donnees: Readonly<Record<string, unknown>> }
  | {
      readonly ok: false;
      readonly code: 'ANNONCE_INTROUVABLE' | 'AMONT_INDISPONIBLE' | 'AMONT_INVALIDE';
    };

const DonneesSchema = z.record(z.string(), z.unknown());

/** Les données d'une annonce Bien'ici ; un objet JSON, sinon un code. Ne lève jamais. */
export async function lireDonneesBienici(
  id: string,
  fetcher: Fetcher,
  delaiMs = DELAI_BIENICI_MS,
): Promise<ReponseDonnees> {
  const url = new URL(URL_DONNEES_BIENICI);
  url.searchParams.set('id', id);
  let reponse: Response;
  try {
    reponse = await fetcher(url, {
      method: 'GET',
      signal: AbortSignal.timeout(delaiMs),
      headers: { Accept: 'application/json', 'User-Agent': AGENT_DEKLIC },
    });
  } catch {
    return { ok: false, code: 'AMONT_INDISPONIBLE' };
  }
  if (reponse.status === 404 || reponse.status === 410) {
    return { ok: false, code: 'ANNONCE_INTROUVABLE' };
  }
  if (!reponse.ok) return { ok: false, code: 'AMONT_INDISPONIBLE' };
  try {
    const lu = DonneesSchema.safeParse(await reponse.json());
    return lu.success ? { ok: true, donnees: lu.data } : { ok: false, code: 'AMONT_INVALIDE' };
  } catch {
    return { ok: false, code: 'AMONT_INVALIDE' };
  }
}
