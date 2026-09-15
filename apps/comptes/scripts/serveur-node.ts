import { mkdirSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { creerApp } from '../src/app';
import { envoyeurJournal } from '../src/courriel';
import { depotArgentD1 } from '../src/gestion/argent/depot-d1';
import { depotBailD1 } from '../src/gestion/bail/depot-d1';
import { depotFinBailD1 } from '../src/gestion/fin-bail/depot-d1';
import { depotD1 } from '../src/gestion/depot-d1';
import { depotEnvoisD1 } from '../src/gestion/envois/depot-d1';
import { signatureJetons } from '../src/gestion/envois/jetons';
import {
  attendreVraiment,
  lireOriginesSupplementaires,
  ORIGINES_DEV,
  ORIGINES_SITE,
  SECRET_DEV,
  SECRET_JETONS_DEV,
} from '../src/dependances';
import { journalConsole } from '../src/journal';
import { depotPartagesD1 } from '../src/partage/depot-d1';
import { depotProjetsD1 } from '../src/projets/depot-d1';
import { d1SurSqlite } from './d1-sqlite';
import { appliquerMigrations } from './migration';

/**
 * L'API des comptes sur Node, pour le développement sur une machine où `wrangler dev` ne démarre pas
 * (le runtime workerd plante sous certains Windows). Même application, base SQLite locale au schéma
 * de D1, codes de connexion écrits dans le terminal. `npm run dev:node -w apps/comptes`.
 */
const PORT = Number(process.env.PORT ?? '8787');
const DOSSIER = new URL('../.wrangler/node/', import.meta.url);

function ouvrirBase(): DatabaseSync {
  mkdirSync(DOSSIER, { recursive: true });
  const base = new DatabaseSync(fileURLToPath(new URL('comptes.sqlite', DOSSIER)));
  appliquerMigrations(base);
  return base;
}

const base = ouvrirBase();

const app = creerApp({
  environnement: 'dev',
  secret: SECRET_DEV,
  base,
  gestion: depotD1(d1SurSqlite(base).base),
  argent: depotArgentD1(d1SurSqlite(base).base),
  bail: depotBailD1(d1SurSqlite(base).base),
  finBail: depotFinBailD1(d1SurSqlite(base).base),
  projets: depotProjetsD1(d1SurSqlite(base).base),
  partages: depotPartagesD1(d1SurSqlite(base).base, SECRET_DEV),
  envois: depotEnvoisD1(d1SurSqlite(base).base),
  jetons: signatureJetons(SECRET_JETONS_DEV),
  attendre: attendreVraiment,
  courriel: envoyeurJournal(journalConsole),
  fournisseurs: {},
  origines: [
    ...ORIGINES_SITE,
    ...ORIGINES_DEV,
    ...lireOriginesSupplementaires(process.env.ORIGINES_AUTORISEES),
  ],
  journal: journalConsole,
  maintenant: () => Date.now(),
});

async function versRequete(entree: IncomingMessage): Promise<Request> {
  const url = new URL(
    entree.url ?? '/',
    `http://${entree.headers.host ?? `localhost:${String(PORT)}`}`,
  );
  const entetes = new Headers();
  for (const [nom, valeur] of Object.entries(entree.headers)) {
    for (const v of Array.isArray(valeur) ? valeur : [valeur]) {
      if (v !== undefined) entetes.append(nom, v);
    }
  }
  const morceaux: Uint8Array[] = [];
  for await (const morceau of entree) morceaux.push(morceau as Uint8Array);
  const methode = entree.method ?? 'GET';
  const sansCorps = methode === 'GET' || methode === 'HEAD' || morceaux.length === 0;
  return new Request(url, {
    method: methode,
    headers: entetes,
    ...(sansCorps ? {} : { body: Buffer.concat(morceaux) }),
  });
}

async function repondre(entree: IncomingMessage, sortie: ServerResponse): Promise<void> {
  const reponse = await app.fetch(await versRequete(entree));
  sortie.statusCode = reponse.status;
  reponse.headers.forEach((valeur, nom) => {
    if (nom !== 'set-cookie') sortie.setHeader(nom, valeur);
  });
  const cookies = reponse.headers.getSetCookie();
  if (cookies.length > 0) sortie.setHeader('set-cookie', cookies);
  sortie.end(Buffer.from(await reponse.arrayBuffer()));
}

createServer((entree, sortie) => {
  repondre(entree, sortie).catch((erreur: unknown) => {
    journalConsole.erreur('serveur-node.erreur', {
      raison: erreur instanceof Error ? erreur.message : String(erreur),
    });
    sortie.statusCode = 500;
    sortie.end();
  });
}).listen(PORT, () => {
  process.stdout.write(`API des comptes (Node) sur http://localhost:${String(PORT)}\n`);
});
