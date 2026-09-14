import { projetExemple, ProjetSchema } from '@loupe/moteur';
import {
  TAILLE_MAX_REQUETE,
  type Changement,
  type ProjetEnregistre,
  type ReponseSynchro,
} from '@loupe/projets';
import type { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import type { DepotProjets } from '../src/projets/depot';
import { SUPPRESSIONS_GARDEES } from '../src/projets/depot-d1';
import { bancD1, compter, connecter, type Banc, type OptionsBancD1 } from './aide';

const CAMILLE = 'camille@example.org';
const LEA = 'lea@example.org';
const DIX = '2026-09-14T10:00:00.000Z';
const DIX_CINQ = '2026-09-14T10:05:00.000Z';

function projet(id: string, modifieLe = DIX, nom = `Projet ${id}`): ProjetEnregistre {
  return {
    id,
    nom,
    statut: 'analyse',
    creeLe: DIX,
    modifieLe,
    projet: ProjetSchema.parse({ ...projetExemple, id }),
  };
}

function enregistrer(p: ProjetEnregistre): Changement {
  return { type: 'enregistrer', projet: p };
}

function supprimer(id: string, le: string): Changement {
  return { type: 'supprimer', id, le };
}

async function synchro(
  b: Banc,
  depuis: number,
  changements: readonly Changement[] = [],
): Promise<ReponseSynchro> {
  const r = await b.requete('/api/projets/synchroniser', { corps: { depuis, changements } });
  expect(r.status).toBe(200);
  expect(r.headers.get('Cache-Control')).toBe('no-store');
  return (await r.json()) as ReponseSynchro;
}

async function connecte(options: OptionsBancD1 = {}): Promise<Banc & { sqlite: DatabaseSync }> {
  const b = bancD1({
    optionsProjets: { maintenant: () => '2026-09-14T12:00:00.000Z' },
    ...options,
  });
  await connecter(b, CAMILLE);
  return b;
}

function ligne(sqlite: DatabaseSync, id: string): Record<string, unknown> | undefined {
  return sqlite.prepare('select modifieLe, revision, supprime from projet where id = ?').get(id);
}

describe('accès à la synchronisation', () => {
  it('sans session : 401 ; une écriture sans Origin connu : 403, rien n’est écrit', async () => {
    const b = bancD1();
    const corps = { depuis: 0, changements: [enregistrer(projet('p1'))] };
    const anonyme = await b.requete('/api/projets/synchroniser', { corps });
    expect(anonyme.status).toBe(401);
    expect(await anonyme.json()).toEqual({ code: 'NON_CONNECTE' });

    await connecter(b, CAMILLE);
    for (const origine of [null, 'https://deklic.pirate.example']) {
      const r = await b.requete('/api/projets/synchroniser', { corps, origine });
      expect(r.status).toBe(403);
    }
    expect(compter(b.sqlite, 'projet')).toBe(0);
  });

  it('corps illisible ou invalide : 400 ; trop gros : 413', async () => {
    const b = await connecte();
    const illisible = await b.requete('/api/projets/synchroniser', { brut: '{pas du json' });
    expect(illisible.status).toBe(400);
    expect(await illisible.json()).toEqual({ code: 'CHAMPS_INVALIDES' });
    const invalide = await b.requete('/api/projets/synchroniser', {
      corps: { depuis: 0, changements: [{ type: 'enregistrer', projet: { id: 'p1' } }] },
    });
    expect(invalide.status).toBe(400);
    const gros = await b.requete('/api/projets/synchroniser', {
      brut: JSON.stringify({ depuis: 0, x: 'x'.repeat(TAILLE_MAX_REQUETE) }),
    });
    expect(gros.status).toBe(413);
    expect(await gros.json()).toEqual({ code: 'CORPS_TROP_GROS' });
  });

  it('base sans la migration 0004 : 503 PROJETS_INDISPONIBLE ; autre panne : 500', async () => {
    const b = bancD1({ migrations: 2 });
    await connecter(b, CAMILLE);
    const r = await b.requete('/api/projets/synchroniser', {
      corps: { depuis: 0, changements: [] },
    });
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ code: 'PROJETS_INDISPONIBLE' });
    expect(b.journal.evenements.map((e) => e.evenement)).toContain('projets.indisponible');

    const enPanne: DepotProjets = { synchroniser: () => Promise.reject(new Error('panne')) };
    const p = bancD1({ surcharges: { projets: enPanne } });
    await connecter(p, CAMILLE);
    const r500 = await p.requete('/api/projets/synchroniser', {
      corps: { depuis: 0, changements: [] },
    });
    expect(r500.status).toBe(500);
    expect(await r500.json()).toEqual({ code: 'ERREUR_INTERNE' });
  });
});

describe('synchronisation des projets', () => {
  it('un compte vide, puis deux projets envoyés, puis relus depuis un autre appareil', async () => {
    const b = await connecte();
    expect(await synchro(b, 0)).toEqual({
      curseur: 0,
      suite: false,
      ids: [],
      refuses: [],
      projets: [],
    });

    const envoi = await synchro(b, 0, [enregistrer(projet('p1')), enregistrer(projet('p2'))]);
    // L'appareil qui envoie ne reçoit pas en retour ce qu'il vient d'écrire.
    expect(envoi).toEqual({
      curseur: 2,
      suite: false,
      ids: ['p1', 'p2'],
      refuses: [],
      projets: [],
    });

    const autre = await synchro(b, 0);
    expect(autre.projets).toEqual([projet('p1'), projet('p2')]);
    expect(await synchro(b, autre.curseur)).toMatchObject({ curseur: 2, projets: [] });
  });

  it('la dernière modification gagne ; un envoi perdu reçoit la version du compte', async () => {
    const b = await connecte();
    await synchro(b, 0, [enregistrer(projet('p1', DIX_CINQ, 'Récent'))]);
    const perdu = await synchro(b, 1, [enregistrer(projet('p1', DIX, 'Ancien'))]);
    expect(perdu.projets).toEqual([projet('p1', DIX_CINQ, 'Récent')]);
    expect(perdu.curseur).toBe(1);
    expect(ligne(b.sqlite, 'p1')).toEqual({ modifieLe: DIX_CINQ, revision: 1, supprime: 0 });

    // À date égale, la dernière arrivée gagne : une horloge d'appareil en avance, bornée à l'heure du
    // serveur, ne fait pas perdre la modification suivante.
    const egal = await synchro(b, 1, [enregistrer(projet('p1', DIX_CINQ, 'Même instant'))]);
    expect(egal).toMatchObject({ curseur: 2, projets: [] });
    expect(ligne(b.sqlite, 'p1')).toEqual({ modifieLe: DIX_CINQ, revision: 2, supprime: 0 });
  });

  it('une date dans le futur est bornée à l’heure du serveur', async () => {
    let maintenant = '2026-09-14T12:00:00.000Z';
    const b = await connecte({ optionsProjets: { maintenant: () => maintenant } });
    await synchro(b, 0, [
      enregistrer(projet('p1', '2026-09-20T00:00:00.000Z', 'Horloge en avance')),
    ]);
    expect(ligne(b.sqlite, 'p1')).toMatchObject({ modifieLe: '2026-09-14T12:00:00.000Z' });

    maintenant = '2026-09-14T12:30:00.000Z';
    const r = await synchro(b, 1, [enregistrer(projet('p1', '2026-09-14T12:10:00.000Z', 'Juste'))]);
    expect(r).toMatchObject({ curseur: 2, projets: [] });
  });

  it('une suppression retire le projet de ids ; une recréation plus ancienne est ignorée, plus récente le ressuscite', async () => {
    const b = await connecte();
    await synchro(b, 0, [enregistrer(projet('p1'))]);
    const supprime = await synchro(b, 1, [supprimer('p1', DIX_CINQ)]);
    expect(supprime.ids).toEqual([]);
    expect(ligne(b.sqlite, 'p1')).toEqual({ modifieLe: DIX_CINQ, revision: 2, supprime: 1 });

    const ignoree = await synchro(b, 2, [enregistrer(projet('p1', DIX))]);
    expect(ignoree).toMatchObject({ ids: [], projets: [] });

    const recree = await synchro(b, 2, [enregistrer(projet('p1', '2026-09-14T11:00:00.000Z'))]);
    expect(recree).toMatchObject({ ids: ['p1'], curseur: 3 });
  });

  it('chaque compte ne voit que ses projets, même à identifiant égal', async () => {
    const b = await connecte();
    const lea = bancD1({ sqlite: b.sqlite });
    await connecter(lea, LEA);
    await synchro(b, 0, [enregistrer(projet('p1', DIX, 'De Camille'))]);
    await synchro(lea, 0, [enregistrer(projet('p1', DIX, 'De Léa'))]);
    expect((await synchro(b, 0)).projets.map((p) => p.nom)).toEqual(['De Camille']);
    expect((await synchro(lea, 0)).projets.map((p) => p.nom)).toEqual(['De Léa']);
    expect(compter(b.sqlite, 'projet')).toBe(2);
  });

  it('à la limite, un projet nouveau est refusé ; une suppression du même lot libère une place', async () => {
    const b = await connecte({ optionsProjets: { limiteProjets: 2 } });
    const plein = await synchro(b, 0, [
      enregistrer(projet('p1')),
      enregistrer(projet('p2')),
      enregistrer(projet('p3')),
    ]);
    expect(plein).toMatchObject({ ids: ['p1', 'p2'], refuses: ['p3'] });
    // Modifier un projet existant reste possible à la limite.
    expect((await synchro(b, 2, [enregistrer(projet('p2', DIX_CINQ))])).refuses).toEqual([]);

    const libere = await synchro(b, 3, [supprimer('p1', DIX_CINQ), enregistrer(projet('p3'))]);
    expect(libere).toMatchObject({ ids: ['p2', 'p3'], refuses: [] });
  });

  it('les projets modifiés se lisent par pages ; un curseur inconnu relit tout', async () => {
    const b = await connecte({ optionsProjets: { page: 2 } });
    await synchro(
      b,
      0,
      ['a', 'b', 'c', 'd', 'e'].map((id) => enregistrer(projet(id))),
    );

    const lus: string[] = [];
    let depuis = 0;
    for (const attendu of [true, true, false]) {
      const r = await synchro(b, depuis);
      expect(r.suite).toBe(attendu);
      lus.push(...r.projets.map((p) => p.id));
      depuis = r.curseur;
    }
    expect(lus).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(depuis).toBe(5);
    expect((await synchro(b, 999)).projets.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('supprimer le compte efface ses projets', async () => {
    const b = await connecte();
    await synchro(b, 0, [enregistrer(projet('p1'))]);
    expect((await b.requete('/api/auth/delete-user', { corps: {} })).status).toBe(200);
    expect(compter(b.sqlite, 'projet')).toBe(0);
  });
});

describe('purge des suppressions', () => {
  function userId(sqlite: DatabaseSync): string {
    return String(sqlite.prepare('select id from "user" where email = ?').get(CAMILLE)?.id);
  }

  function tombe(sqlite: DatabaseSync, id: string, modifieLe: string, revision: number): void {
    sqlite
      .prepare(
        'insert into projet (userId, id, contenu, modifieLe, revision, supprime) values (?, ?, null, ?, ?, 1)',
      )
      .run(userId(sqlite), id, modifieLe, revision);
  }

  it('oublie les suppressions de plus de 90 jours, jamais la révision maximale', async () => {
    const b = await connecte();
    tombe(b.sqlite, 'vieille', '2026-05-01T00:00:00.000Z', 1);
    await synchro(b, 1, [supprimer('ancienne-date', '2026-01-01T00:00:00.000Z')]);
    expect(ligne(b.sqlite, 'vieille')).toBeUndefined();
    // La suppression datée de janvier porte la révision maximale : elle reste.
    expect(ligne(b.sqlite, 'ancienne-date')).toMatchObject({ revision: 2, supprime: 1 });
  });

  it(`garde au plus ${String(SUPPRESSIONS_GARDEES)} suppressions`, async () => {
    const b = await connecte();
    for (let i = 1; i <= SUPPRESSIONS_GARDEES + 2; i += 1) tombe(b.sqlite, `t${String(i)}`, DIX, i);
    await synchro(b, 0, [supprimer('derniere', DIX_CINQ)]);
    expect(compter(b.sqlite, 'projet')).toBe(SUPPRESSIONS_GARDEES);
    expect(ligne(b.sqlite, 't3')).toBeUndefined();
    expect(ligne(b.sqlite, 't4')).toMatchObject({ supprime: 1 });
  });
});
