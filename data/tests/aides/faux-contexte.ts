import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import type { Contexte } from '../../src/commun/contexte.ts';
import { creerJournal } from '../../src/commun/journal.ts';

/** Répond à une URL ; `undefined` vaut 404. */
export type Repondeur = (url: string, init: RequestInit | undefined) => Response | undefined;

export interface EntreeJournal {
  readonly niveau: string;
  readonly message: string;
  readonly [cle: string]: unknown;
}

export interface Appel {
  readonly url: string;
  readonly methode: string;
}

export interface FauxContexte {
  readonly contexte: Contexte;
  readonly journal: EntreeJournal[];
  readonly appels: Appel[];
  readonly pauses: number[];
}

export const INSTANT_TEST = new Date('2026-09-13T10:00:00.000Z');

export function fauxContexte(
  repondre: Repondeur,
  dossierSortie = 'dist',
  horloge: () => Date = () => INSTANT_TEST,
): FauxContexte {
  const journal: EntreeJournal[] = [];
  const appels: Appel[] = [];
  const pauses: number[] = [];
  const recuperer = ((entree: string | URL | Request, init?: RequestInit) => {
    const url = entree instanceof Request ? entree.url : String(entree);
    appels.push({ url, methode: init?.method ?? 'GET' });
    return Promise.resolve(repondre(url, init) ?? new Response('introuvable', { status: 404 }));
  }) as typeof fetch;
  const contexte: Contexte = {
    recuperer,
    pause: (millisecondes) => {
      pauses.push(millisecondes);
      return Promise.resolve();
    },
    horloge,
    journal: creerJournal({
      ecrire: (ligne) => {
        journal.push(JSON.parse(ligne) as EntreeJournal);
      },
      horloge,
      annotationsGitHub: false,
    }),
    dossierSortie,
  };
  return { contexte, journal, appels, pauses };
}

export async function dossierTemporaire(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'loupe-data-'));
}

export function cheminFixture(relatif: string): string {
  return fileURLToPath(new URL(`../fixtures/${relatif}`, import.meta.url));
}

export async function lireFixture(relatif: string): Promise<Buffer> {
  return readFile(cheminFixture(relatif));
}

export function reponseGzip(contenu: string | Buffer): Response {
  return new Response(gzipSync(contenu));
}

export function reponseTexte(contenu: string | Buffer): Response {
  return new Response(contenu);
}
