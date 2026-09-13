import { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';
import type { Contexte } from './contexte.ts';
import { decoderTexte, type Encodage } from './flux.ts';

const TENTATIVES_MAX = 3;
const DELAI_BASE_MS = 2000;

export class ErreurTelechargement extends Error {
  readonly url: string;
  readonly statut: number;

  constructor(url: string, statut: number) {
    super(`téléchargement impossible (HTTP ${String(statut)}) : ${url}`);
    this.name = 'ErreurTelechargement';
    this.url = url;
    this.statut = statut;
  }
}

interface Succes {
  readonly ok: true;
  readonly reponse: Response;
}

interface Echec {
  readonly ok: false;
  readonly erreur: Error;
  readonly reessayable: boolean;
}

async function tenter(
  url: string,
  contexte: Contexte,
  init: RequestInit | undefined,
): Promise<Succes | Echec> {
  try {
    const reponse = await contexte.recuperer(url, init);
    if (reponse.ok) {
      return { ok: true, reponse };
    }
    return {
      ok: false,
      erreur: new ErreurTelechargement(url, reponse.status),
      reessayable: reponse.status >= 500,
    };
  } catch (erreur) {
    return {
      ok: false,
      erreur: erreur instanceof Error ? erreur : new Error(String(erreur)),
      reessayable: true,
    };
  }
}

/** Ouvre une URL avec jusqu'à trois tentatives sur erreur réseau ou HTTP 5xx ; les 4xx sont définitives. */
export async function ouvrir(
  url: string,
  contexte: Contexte,
  init?: RequestInit,
): Promise<Response> {
  let tentative = 1;
  let resultat = await tenter(url, contexte, init);
  while (!resultat.ok && resultat.reessayable && tentative < TENTATIVES_MAX) {
    contexte.journal.avertissement('téléchargement à réessayer', {
      url,
      tentative,
      cause: resultat.erreur.message,
    });
    await contexte.pause(DELAI_BASE_MS * tentative);
    tentative += 1;
    resultat = await tenter(url, contexte, init);
  }
  if (resultat.ok) {
    return resultat.reponse;
  }
  throw resultat.erreur;
}

export async function telechargerTexte(url: string, contexte: Contexte): Promise<string> {
  const reponse = await ouvrir(url, contexte);
  return reponse.text();
}

export async function telechargerJson(url: string, contexte: Contexte): Promise<unknown> {
  const reponse = await ouvrir(url, contexte);
  return reponse.json();
}

export interface OptionsFlux {
  readonly gzip: boolean;
  readonly encodage: Encodage;
}

/** Texte d'une ressource distante, morceau par morceau, décompressé et décodé à la volée. */
export async function* telechargerTexteEnFlux(
  url: string,
  contexte: Contexte,
  options: OptionsFlux,
): AsyncGenerator<string> {
  const reponse = await ouvrir(url, contexte);
  if (reponse.body === null) {
    return;
  }
  let flux: Readable = Readable.fromWeb(reponse.body);
  if (options.gzip) {
    flux = flux.pipe(createGunzip());
  }
  yield* decoderTexte(flux, options.encodage);
}

/** Vrai si la ressource répond 2xx à une requête HEAD (sondage des millésimes disponibles). */
export async function existe(url: string, contexte: Contexte): Promise<boolean> {
  const reponse = await contexte.recuperer(url, { method: 'HEAD' });
  return reponse.ok;
}
