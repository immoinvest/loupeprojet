import { projetExemple, ProjetSchema } from '@loupe/moteur';
import { TAILLE_MAX_PARTAGE, type PartageCree, type ProjetEnregistre } from '@loupe/projets';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { d1SurSqlite } from '../scripts/d1-sqlite';
import { appliquerMigrations } from '../scripts/migration';
import { creerApp } from '../src/app';
import { estTablePartageAbsente } from '../src/partage/depot';
import { depotPartagesD1 } from '../src/partage/depot-d1';
import {
  empreinte,
  LONGUEUR_IDENTIFIANT,
  nouveauJeton,
  nouvelIdentifiant,
} from '../src/partage/jetons';
import { bancD1, compter, type BancD1, type OptionsBancD1 } from './aide';

const DIX = '2026-09-15T10:00:00.000Z';
const HEURE = 3_600_000;
const JOUR = 24 * HEURE;

function projet(id = 'p1'): ProjetEnregistre {
  return {
    id,
    nom: 'T2 · Lyon',
    statut: 'offre',
    creeLe: DIX,
    modifieLe: DIX,
    visite: { faite: true, reponses: { DOC_TITRE_PLAN: { etat: 'probleme', note: 'personnel' } } },
    projet: ProjetSchema.parse({ ...projetExemple, id }),
  };
}

/** Un banc sur D1 simulée dont l'horloge du dépôt de partage se règle à la main. */
function bancHorloge(options: OptionsBancD1 = {}): BancD1 & { avancer: (ms: number) => void } {
  let maintenant = Date.parse(DIX);
  const b = bancD1({
    ...options,
    optionsPartages: { maintenant: () => maintenant, ...options.optionsPartages },
  });
  return {
    ...b,
    avancer: (ms) => {
      maintenant += ms;
    },
  };
}

async function creer(b: BancD1, corps: unknown = { projet: projet() }): Promise<PartageCree> {
  const r = await b.requete('/api/partage', { corps });
  expect(r.status).toBe(201);
  expect(r.headers.get('Cache-Control')).toBe('no-store');
  return (await r.json()) as PartageCree;
}

describe('identifiants et jetons', () => {
  it('8 caractères base62 ; les octets au-dessus de 247 sont rejetés (aucun biais)', () => {
    expect(nouvelIdentifiant()).toMatch(/^[0-9A-Za-z]{8}$/);
    const tirages = [
      Uint8Array.from([255, 0, 1, 61, 62, 247, 248, 10]),
      Uint8Array.from([2, 3, 4, 5, 6, 7, 8, 9]),
    ];
    let i = 0;
    const id = nouvelIdentifiant((n) => (tirages[i++] ?? new Uint8Array(n)).slice(0, n));
    expect(id).toHaveLength(LONGUEUR_IDENTIFIANT);
    expect(id).toBe('01z0zA23');
  });

  it('jeton de 43 caractères base64url, empreinte SHA-256 hexadécimale', async () => {
    expect(nouveauJeton()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(nouveauJeton(() => new Uint8Array(32).fill(251))).toBe('-_v7'.repeat(10) + '-_s');
    expect(await empreinte('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('POST /api/partage', () => {
  it('crée un lien de 8 caractères, stocke le projet sans la visite, l’IP en empreinte seulement', async () => {
    const b = bancHorloge();
    const cree = await creer(b);
    expect(cree.id).toMatch(/^[0-9A-Za-z]{8}$/);
    expect(cree.jeton).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(cree.expireLe).toBe('2026-12-14T10:00:00.000Z');
    const ligne = b.sqlite.prepare('select * from partage').get() as Record<string, string>;
    const stocke = JSON.parse(ligne.contenu ?? '') as ProjetEnregistre;
    expect(stocke).not.toHaveProperty('visite');
    expect(stocke.nom).toBe('T2 · Lyon');
    expect(ligne.jetonHash).toBe(await empreinte(cree.jeton));
    expect(ligne.ipHash).toBe(await empreinte(`sel-de-test:ip:${b.ip}`));
    expect(JSON.stringify(ligne)).not.toContain(b.ip);
  });

  it('refuse un corps invalide (400), trop gros (413), une écriture sans Origin connu (403)', async () => {
    const b = bancHorloge();
    expect((await b.requete('/api/partage', { brut: '{pas du json' })).status).toBe(400);
    expect((await b.requete('/api/partage', { corps: { projet: { id: 'x' } } })).status).toBe(400);
    const gros = await b.requete('/api/partage', {
      brut: JSON.stringify({ projet: { ...projet(), nom: 'x'.repeat(TAILLE_MAX_PARTAGE) } }),
    });
    expect(gros.status).toBe(413);
    expect(await gros.json()).toEqual({ code: 'CORPS_TROP_GROS' });
    for (const origine of [null, 'https://app.deklic.pro.pirate.example']) {
      const r = await b.requete('/api/partage', { corps: { projet: projet() }, origine });
      expect(r.status).toBe(403);
    }
    expect(compter(b.sqlite, 'partage')).toBe(0);
  });

  it('refuse un hôte inconnu, même en lecture', async () => {
    const b = bancHorloge({ origine: 'https://deklic.pirate.example' });
    expect((await b.requete('/api/partage/7fK2qA9x')).status).toBe(403);
  });

  it('10 créations par heure par IP, puis 429 ; l’heure passée, l’empreinte est effacée et la limite repart', async () => {
    const b = bancHorloge({ optionsPartages: { limiteParHeure: 2 } });
    await creer(b);
    await creer(b);
    const refus = await b.requete('/api/partage', { corps: { projet: projet() } });
    expect(refus.status).toBe(429);
    expect(await refus.json()).toEqual({ code: 'LIMITE_ATTEINTE' });
    // Une autre adresse IP n'est pas concernée.
    const autre = await b.requete('/api/partage', {
      corps: { projet: projet() },
      headers: { 'cf-connecting-ip': '198.51.100.7' },
    });
    expect(autre.status).toBe(201);

    b.avancer(HEURE + 1);
    await creer(b);
    const empreintes = b.sqlite
      .prepare('select ipHash from partage order by creeLe')
      .all()
      .map((l) => l.ipHash);
    expect(empreintes.slice(0, 3)).toEqual([null, null, null]);
    expect(empreintes[3]).not.toBeNull();
  });

  it('sans en-tête d’IP, toutes les demandes comptent ensemble', async () => {
    const b = bancHorloge({ optionsPartages: { limiteParHeure: 1 } });
    const app = creerApp(b.deps);
    const envoyer = (): Promise<Response> =>
      Promise.resolve(
        app.request('http://localhost:5173/api/partage', {
          method: 'POST',
          headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
          body: JSON.stringify({ projet: projet() }),
        }),
      );
    expect((await envoyer()).status).toBe(201);
    expect((await envoyer()).status).toBe(429);
    expect(b.sqlite.prepare('select ipHash from partage').get()?.ipHash).toBe(
      await empreinte('sel-de-test:ip:inconnue'),
    );
  });

  it('un identifiant déjà pris est retiré ; trois fois de suite : erreur 500 journalisée', async () => {
    const constant = (n: number): Uint8Array => new Uint8Array(n).fill(7);
    const b = bancHorloge({ optionsPartages: { aleatoire: constant } });
    const premier = await creer(b);
    expect(premier.id).toBe('77777777');
    const r = await b.requete('/api/partage', { corps: { projet: projet() } });
    expect(r.status).toBe(500);
    expect(b.journal.evenements.some((e) => e.evenement === 'erreur.interne')).toBe(true);
  });
});

describe('GET /api/partage/:id', () => {
  it('rend le projet et prolonge l’expiration à chaque ouverture', async () => {
    const b = bancHorloge();
    const { id } = await creer(b);
    b.avancer(80 * JOUR);
    const r = await b.requete(`/api/partage/${id}`);
    expect(r.status).toBe(200);
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    const lu = (await r.json()) as { projet: ProjetEnregistre; expireLe: string };
    expect(lu.projet.nom).toBe('T2 · Lyon');
    expect(lu.projet).not.toHaveProperty('visite');
    expect(lu.expireLe).toBe('2027-03-04T10:00:00.000Z');
    b.avancer(80 * JOUR);
    expect((await b.requete(`/api/partage/${id}`)).status).toBe(200);
  });

  it('404 pour un identifiant mal formé, inconnu ou expiré ; les expirés sont purgés à la création suivante', async () => {
    const b = bancHorloge();
    const { id } = await creer(b);
    for (const chemin of ['/api/partage/court', '/api/partage/ZZZZZZZZ']) {
      const r = await b.requete(chemin);
      expect(r.status).toBe(404);
      expect(await r.json()).toEqual({ code: 'INTROUVABLE' });
    }
    b.avancer(90 * JOUR);
    expect((await b.requete(`/api/partage/${id}`)).status).toBe(404);
    await creer(b);
    expect(compter(b.sqlite, 'partage')).toBe(1);
  });
});

describe('DELETE /api/partage/:id', () => {
  it('avec le bon jeton : 204, le lien ne s’ouvre plus ; sinon 404 et rien ne bouge', async () => {
    const b = bancHorloge();
    const { id, jeton } = await creer(b);
    const supprimer = (
      chemin: string,
      corps: unknown,
      origine?: string | null,
    ): Promise<Response> =>
      b.requete(chemin, { method: 'DELETE', corps, ...(origine === undefined ? {} : { origine }) });

    expect((await supprimer(`/api/partage/${id}`, { jeton: 'mauvais' })).status).toBe(404);
    expect((await supprimer('/api/partage/court', { jeton })).status).toBe(404);
    expect((await supprimer(`/api/partage/${id}`, {})).status).toBe(400);
    expect((await supprimer(`/api/partage/${id}`, { jeton }, null)).status).toBe(403);
    expect(compter(b.sqlite, 'partage')).toBe(1);

    const r = await supprimer(`/api/partage/${id}`, { jeton });
    expect(r.status).toBe(204);
    expect((await b.requete(`/api/partage/${id}`)).status).toBe(404);
    expect((await supprimer(`/api/partage/${id}`, { jeton })).status).toBe(404);
  });
});

describe('base pas encore migrée', () => {
  it('503 PARTAGE_INDISPONIBLE sur les trois routes, le site reste servi', async () => {
    const b = bancD1({ migrations: 5 });
    const creation = await b.requete('/api/partage', { corps: { projet: projet() } });
    expect(creation.status).toBe(503);
    expect(await creation.json()).toEqual({ code: 'PARTAGE_INDISPONIBLE' });
    expect((await b.requete('/api/partage/7fK2qA9x')).status).toBe(503);
    expect(
      (await b.requete('/api/partage/7fK2qA9x', { method: 'DELETE', corps: { jeton: 'x' } }))
        .status,
    ).toBe(503);
    expect(b.journal.evenements.some((e) => e.evenement === 'partage.indisponible')).toBe(true);
    expect(estTablePartageAbsente('autre chose')).toBe(false);
  });

  it('le dépôt se construit sans horloge ni tirage fournis', async () => {
    const sqlite = new DatabaseSync(':memory:');
    appliquerMigrations(sqlite);
    const depot = depotPartagesD1(d1SurSqlite(sqlite).base, 'sel');
    const cree = await depot.creer('{}', '203.0.113.1');
    expect(cree).not.toBe('limite');
    if (cree !== 'limite') expect(await depot.lire(cree.id)).not.toBeNull();
  });
});
