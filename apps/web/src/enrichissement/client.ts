import type { z } from 'zod';

import {
  ErreurWorkerSchema,
  ReponseAdressesDvfSchema,
  ReponseSuggestionsSchema,
  type AdresseDvf,
  type SuggestionAdresse,
  ReponseCommunesSchema,
  ReponseAdresseSchema,
  ReponseDpeSchema,
  ReponseExtractionSchema,
  ReponseGeocodageSchema,
  ReponseLectureSchema,
  ReponseMarcheSchema,
  ReponseRisquesSchema,
  type ChampsIa,
  type Commune,
  type DpeAdresse,
  type PageLue,
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

/** Les communes d'un code postal à cinq chiffres, ou celles dont le nom commence par `nom`. */
export type RechercheCommunes = { readonly codePostal: string } | { readonly nom: string };

/** Ce que l'application demande au Worker. Chaque échec devient un code : l'écran décide quoi en faire. */
export interface ClientWorker {
  extraire(texte: string): Promise<Resultat<ChampsIa>>;
  geocoder(recherche: string, codePostal?: string): Promise<Resultat<ResultatGeocodage | null>>;
  marche(parametres: ParametresMarche): Promise<Resultat<ReponseMarche>>;
  analyserAdresse(parametres: ParametresAdresse): Promise<Resultat<ReponseAdresse>>;
  dpe(position: Position): Promise<Resultat<readonly DpeAdresse[]>>;
  risques(position: Position): Promise<Resultat<ReponseRisques>>;
  /** Communes proposées pendant la saisie ; `signal` abandonne une recherche dépassée par la frappe. */
  communes(
    recherche: RechercheCommunes,
    signal?: AbortSignal,
  ): Promise<Resultat<readonly Commune[]>>;
  /** Adresses proposées pendant la frappe, près de `position` d'abord quand on la connaît. */
  suggererAdresses(
    texte: string,
    position: Position | null,
    signal?: AbortSignal,
  ): Promise<Resultat<readonly SuggestionAdresse[]>>;
  /** Adresses du cadastre de la commune (numéros fiscaux, résidences) qui répondent au texte. */
  adressesDvf(
    codeInsee: string,
    texte: string,
    signal?: AbortSignal,
  ): Promise<Resultat<readonly AdresseDvf[]>>;
  /** La page d'une annonce, lue par le Worker ; `signal` permet d'abandonner l'attente. */
  lirePage(url: string, signal?: AbortSignal): Promise<Resultat<PageLue>>;
}

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Versions des contrats de réponse du Worker, ajoutées aux URL : une nouvelle version change l’URL, donc
 * le navigateur ne ressert pas depuis son cache HTTP une réponse d’avant (champ absent, carte invisible).
 * À monter avec `VERSION_CONTRAT` de `apps/worker/src/marche/route.ts` et `apps/worker/src/adresse/route.ts`.
 */
export const CONTRAT_MARCHE = 2;
export const CONTRAT_ADRESSE = 7;
/** Version de la liste des adresses du cadastre (`VERSION_LISTE` de `apps/worker/src/adresse/route-adresses-dvf.ts`). */
export const CONTRAT_ADRESSES_DVF = 1;
/** Suggestions pendant la frappe : court, une autre frappe suit. */
export const DELAI_SUGGESTIONS_MS = 6_000;
export const LIMITE_SUGGESTIONS = 6;

export const URL_WORKER_DEFAUT = 'https://loupe-worker.erreip-gorguel.workers.dev';
/** Le modèle a 25 s côté Worker : on lui laisse un peu de marge. */
export const DELAI_EXTRACTION_MS = 30_000;
export const DELAI_DONNEES_MS = 10_000;
/** Lecture du CSV de la commune et deux appels au cadastre : un peu plus long. */
export const DELAI_ADRESSE_MS = 20_000;
/** Le Worker fait jusqu'à deux lectures de 70 s chacune (SeLoger a mis 74 s le 14/09/2026). */
export const DELAI_LECTURE_PAGE_MS = 160_000;

/** Le délai de la requête, et l'abandon demandé par l'écran s'il y en a un : le premier des deux l'emporte. */
export function signalDeRequete(delaiMs: number, externe?: AbortSignal): AbortSignal {
  const delai = AbortSignal.timeout(delaiMs);
  if (externe === undefined) return delai;
  const controleur = new AbortController();
  const interrompre = (): void => {
    controleur.abort();
  };
  if (externe.aborted) interrompre();
  externe.addEventListener('abort', interrompre, { once: true });
  delai.addEventListener('abort', interrompre, { once: true });
  return controleur.signal;
}

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
  signal?: AbortSignal,
): Promise<Resultat<T>> {
  let reponse: Response;
  try {
    reponse = await fetcher(url, { ...init, signal: signalDeRequete(delaiMs, signal) });
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
      q.set('contrat', String(CONTRAT_MARCHE));
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
      q.set('contrat', String(CONTRAT_ADRESSE));
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
    async communes(recherche, signal) {
      const q = new URLSearchParams(
        'codePostal' in recherche ? { codePostal: recherche.codePostal } : { nom: recherche.nom },
      );
      const r = await appeler(
        fetcher,
        `${base}/proxy/communes?${q.toString()}`,
        { method: 'GET' },
        ReponseCommunesSchema,
        DELAI_DONNEES_MS,
        signal,
      );
      return r.ok ? { ok: true, valeur: r.valeur.donnees.communes } : r;
    },
    async suggererAdresses(texte, lieu, signal) {
      const q = new URLSearchParams({ q: texte, limit: String(LIMITE_SUGGESTIONS) });
      if (lieu !== null) {
        q.set('lat', String(lieu.lat));
        q.set('lon', String(lieu.lon));
      }
      const r = await appeler(
        fetcher,
        `${base}/proxy/adresses?${q.toString()}`,
        { method: 'GET' },
        ReponseSuggestionsSchema,
        DELAI_SUGGESTIONS_MS,
        signal,
      );
      return r.ok ? { ok: true, valeur: r.valeur.donnees.suggestions } : r;
    },
    async adressesDvf(codeInsee, texte, signal) {
      const q = new URLSearchParams({
        codeInsee,
        texte,
        contrat: String(CONTRAT_ADRESSES_DVF),
      });
      const r = await appeler(
        fetcher,
        `${base}/marche/adresses-dvf?${q.toString()}`,
        { method: 'GET' },
        ReponseAdressesDvfSchema,
        DELAI_SUGGESTIONS_MS,
        signal,
      );
      return r.ok ? { ok: true, valeur: r.valeur.adresses } : r;
    },
    lirePage(url, signal) {
      return appeler(
        fetcher,
        `${base}/lecture`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url }),
        },
        ReponseLectureSchema,
        DELAI_LECTURE_PAGE_MS,
        signal,
      );
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
  communes: () => horsLigne(),
  suggererAdresses: () => horsLigne(),
  adressesDvf: () => horsLigne(),
  lirePage: () => horsLigne(),
};
