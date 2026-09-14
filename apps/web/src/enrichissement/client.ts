import type { z } from 'zod';

import {
  ErreurWorkerSchema,
  ReponseAdresseSchema,
  ReponseDpeSchema,
  ReponseExtractionSchema,
  ReponseGeocodageSchema,
  ReponseMarcheSchema,
  ReponseRisquesSchema,
  type ChampsIa,
  type DpeAdresse,
  type ReponseAdresse,
  type ReponseMarche,
  type ReponseRisques,
  type ResultatGeocodage,
} from './contrat';

export type Resultat<T> =
  { readonly ok: true; readonly valeur: T } | { readonly ok: false; readonly code: string };

export interface ParametresMarche {
  readonly codeInsee: string;
  readonly codePostal: string;
  readonly type: 'appartement' | 'maison';
  readonly pieces?: number | undefined;
}

export interface ParametresAdresse {
  readonly codeInsee: string;
  readonly lat: number;
  readonly lon: number;
  readonly numero: number | null;
  readonly codeVoie: string | null;
  readonly type: 'appartement' | 'maison';
  readonly surface: number;
}

export interface Position {
  readonly lat: number;
  readonly lon: number;
}

/** Ce que l'application demande au Worker. Chaque échec devient un code : l'écran décide quoi en faire. */
export interface ClientWorker {
  extraire(texte: string): Promise<Resultat<ChampsIa>>;
  geocoder(recherche: string, codePostal?: string): Promise<Resultat<ResultatGeocodage | null>>;
  marche(parametres: ParametresMarche): Promise<Resultat<ReponseMarche>>;
  analyserAdresse(parametres: ParametresAdresse): Promise<Resultat<ReponseAdresse>>;
  dpe(position: Position): Promise<Resultat<readonly DpeAdresse[]>>;
  risques(position: Position): Promise<Resultat<ReponseRisques>>;
}

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export const URL_WORKER_DEFAUT = 'https://loupe-worker.erreip-gorguel.workers.dev';
/** Le modèle a 25 s côté Worker : on lui laisse un peu de marge. */
export const DELAI_EXTRACTION_MS = 30_000;
export const DELAI_DONNEES_MS = 10_000;
/** Lecture du CSV de la commune et deux appels au cadastre : un peu plus long. */
export const DELAI_ADRESSE_MS = 20_000;

/** Adresse du Worker : `VITE_WORKER_URL` si elle est valable, la production sinon. */
export function urlWorker(valeur: unknown): string {
  return typeof valeur === 'string' && /^https?:\/\/\S+$/.test(valeur)
    ? valeur.replace(/\/+$/, '')
    : URL_WORKER_DEFAUT;
}

async function appeler<T>(
  fetcher: Fetch,
  url: string,
  init: RequestInit,
  schema: z.ZodType<T>,
  delaiMs: number,
): Promise<Resultat<T>> {
  let reponse: Response;
  try {
    reponse = await fetcher(url, { ...init, signal: AbortSignal.timeout(delaiMs) });
  } catch {
    return { ok: false, code: 'RESEAU' };
  }
  let corps: unknown;
  try {
    corps = await reponse.json();
  } catch {
    return { ok: false, code: 'REPONSE_INVALIDE' };
  }
  if (!reponse.ok) {
    const erreur = ErreurWorkerSchema.safeParse(corps);
    return {
      ok: false,
      code: erreur.success ? erreur.data.code : `HTTP_${String(reponse.status)}`,
    };
  }
  const lecture = schema.safeParse(corps);
  return lecture.success
    ? { ok: true, valeur: lecture.data }
    : { ok: false, code: 'REPONSE_INVALIDE' };
}

const position = (p: Position): string =>
  new URLSearchParams({ lat: String(p.lat), lon: String(p.lon) }).toString();

export function clientWorker(base: string, fetcher: Fetch): ClientWorker {
  return {
    async extraire(texte) {
      const r = await appeler(
        fetcher,
        `${base}/extract`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ texte }),
        },
        ReponseExtractionSchema,
        DELAI_EXTRACTION_MS,
      );
      return r.ok ? { ok: true, valeur: r.valeur.champs } : r;
    },
    async geocoder(recherche, codePostal) {
      const q = new URLSearchParams({ q: recherche, limit: '1' });
      if (codePostal !== undefined) q.set('codePostal', codePostal);
      const r = await appeler(
        fetcher,
        `${base}/proxy/geocodage?${q.toString()}`,
        { method: 'GET' },
        ReponseGeocodageSchema,
        DELAI_DONNEES_MS,
      );
      return r.ok ? { ok: true, valeur: r.valeur.donnees.resultats[0] ?? null } : r;
    },
    marche(p) {
      const q = new URLSearchParams({
        codeInsee: p.codeInsee,
        codePostal: p.codePostal,
        type: p.type,
      });
      if (p.pieces !== undefined) q.set('pieces', String(p.pieces));
      return appeler(
        fetcher,
        `${base}/marche?${q.toString()}`,
        { method: 'GET' },
        ReponseMarcheSchema,
        DELAI_DONNEES_MS,
      );
    },
    analyserAdresse(p) {
      const q = new URLSearchParams({
        codeInsee: p.codeInsee,
        lat: String(p.lat),
        lon: String(p.lon),
        type: p.type,
        surface: String(p.surface),
      });
      if (p.numero !== null) q.set('numero', String(p.numero));
      if (p.codeVoie !== null) q.set('codeVoie', p.codeVoie);
      return appeler(
        fetcher,
        `${base}/marche/adresse?${q.toString()}`,
        { method: 'GET' },
        ReponseAdresseSchema,
        DELAI_ADRESSE_MS,
      );
    },
    async dpe(p) {
      const r = await appeler(
        fetcher,
        `${base}/proxy/dpe?${position(p)}`,
        { method: 'GET' },
        ReponseDpeSchema,
        DELAI_DONNEES_MS,
      );
      return r.ok ? { ok: true, valeur: r.valeur.donnees.dpe } : r;
    },
    async risques(p) {
      const r = await appeler(
        fetcher,
        `${base}/proxy/risques?${position(p)}`,
        { method: 'GET' },
        ReponseRisquesSchema,
        DELAI_DONNEES_MS,
      );
      return r.ok ? { ok: true, valeur: r.valeur.donnees } : r;
    },
  };
}

const horsLigne = <T>(): Promise<Resultat<T>> => Promise.resolve({ ok: false, code: 'HORS_LIGNE' });

/** Client sans réseau : l'application retombe sur la lecture par règles et un projet sans marché. */
export const clientHorsLigne: ClientWorker = {
  extraire: () => horsLigne(),
  geocoder: () => horsLigne(),
  marche: () => horsLigne(),
  analyserAdresse: () => horsLigne(),
  dpe: () => horsLigne(),
  risques: () => horsLigne(),
};
