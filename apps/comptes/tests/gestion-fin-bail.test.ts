import type {
  ColocataireChange,
  CongeEnregistre,
  CreationLocation,
  CreationReponse,
  DocumentComplet,
  EtatFinBail,
  NouvelleLocation,
} from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import { d1SurSqlite } from '../scripts/d1-sqlite';
import { appliquerMigrations, MIGRATIONS } from '../scripts/migration';
import { depotFinBailD1 } from '../src/gestion/fin-bail/depot-d1';
import {
  ErreurFinBail,
  estTableFinBailAbsente,
  type DepotFinBail,
} from '../src/gestion/fin-bail/depot';
import { mouvementsSiDisponibles } from '../src/gestion/fin-bail/lecture';
import type { Lier } from '../src/gestion/lignes';
import { bancD1, connecter, type BancD1 } from './aide';

const CAMILLE = 'camille@example.org';
/** Le 15 décembre 2026. */
const MAINTENANT = '2026-12-15T09:00:00.000Z';
const LEA = { prenom: 'Léa', nom: 'Bernard' };
const HUGO = { prenom: 'Hugo', nom: 'Petit' };

const LOCATION: NouvelleLocation = {
  type: 'meublee',
  debut: '2026-10-01',
  jourLoyer: 5,
  loyerHorsCharges: 65_000,
  charges: 5_000,
  depot: 130_000,
};

function creation(location: NouvelleLocation = LOCATION): CreationLocation {
  return {
    bien: {
      nom: 'T2 Lices',
      adresse: '12 rue des Lices, Marseille',
      type: 'appartement',
      meuble: true,
    },
    locataire: { prenom: 'Julie', nom: 'Martin' },
    location,
  };
}

async function lire<T>(reponse: Response): Promise<T> {
  return (await reponse.json()) as T;
}

async function connecte(sqlite?: BancD1['sqlite'], migrations?: number): Promise<BancD1> {
  const b = bancD1({
    optionsDepot: { maintenant: () => MAINTENANT },
    ...(sqlite === undefined ? {} : { sqlite }),
    ...(migrations === undefined ? {} : { migrations }),
  });
  await connecter(b, sqlite === undefined ? CAMILLE : 'antoine.dupont@example.org');
  return b;
}

async function creer(b: BancD1, c: CreationLocation = creation()): Promise<CreationReponse> {
  const r = await b.requete('/api/gestion/locations', { corps: c });
  expect(r.status).toBe(201);
  return lire<CreationReponse>(r);
}

function conge(b: BancD1, id: string, corps: object): Promise<Response> {
  return b.requete(`/api/gestion/fin-bail/locations/${id}/conge`, { method: 'PUT', corps });
}

function etat(b: BancD1): Promise<Response> {
  return b.requete('/api/gestion/fin-bail');
}

const CONGE = { recuLe: '2026-12-05', fin: '2027-01-05', reduit: false };

describe('migration sans risque : base sans 0011', () => {
  const avant0011 = MIGRATIONS.findIndex((m) => m.fichier.startsWith('0011'));

  it('les routes existantes répondent comme avant (quittance comprise) ; celles de la fin du bail rendent 503', async () => {
    const b = await connecte(undefined, avant0011);
    // Une location déjà terminée : la restitution du dépôt va jusqu'à la lecture des nouvelles tables.
    const { bien, location } = await creer(
      b,
      creation({ ...LOCATION, debut: '2025-10-01', fin: '2026-12-31' }),
    );
    const id = location?.id ?? '';
    expect((await b.requete('/api/gestion/etat')).status).toBe(200);
    expect(
      (
        await b.requete('/api/gestion/bailleur', {
          method: 'PUT',
          corps: { nom: 'Camille Roux', adresse: '3 rue Paradis, 13006 Marseille' },
        })
      ).status,
    ).toBe(200);
    const paiement = { locationId: id, periode: '2026-12', montant: 70_000, date: '2026-12-05' };
    expect((await b.requete('/api/gestion/paiements', { corps: paiement })).status).toBe(201);
    const quittance = { type: 'quittance', locationId: id, periode: '2026-12' };
    const emise = await b.requete('/api/gestion/documents', { corps: quittance });
    expect(emise.status).toBe(201);
    expect((await lire<DocumentComplet>(emise)).contenu.locataires).toEqual([
      { prenom: 'Julie', nom: 'Martin' },
    ]);
    expect((await b.requete('/api/gestion/export')).status).toBe(200);
    expect((await b.requete('/api/gestion/bail')).status).toBe(200);
    expect((await b.requete('/api/gestion/argent')).status).toBe(200);

    const restitution = { clesLe: '2026-12-01', conforme: true, retenues: [] };
    const indisponibles = [
      await etat(b),
      await conge(b, id, CONGE),
      await b.requete(`/api/gestion/fin-bail/locations/${id}/conge`, { method: 'DELETE' }),
      await b.requete(`/api/gestion/fin-bail/locations/${id}/charges`, {
        method: 'PUT',
        corps: { mode: 'forfait' },
      }),
      await b.requete(`/api/gestion/fin-bail/locations/${id}/restitution`, { corps: restitution }),
      await b.requete(`/api/gestion/fin-bail/locations/${id}/restitution/rendue`, {
        corps: { rendueLe: '2026-12-10' },
      }),
      await b.requete(`/api/gestion/fin-bail/locations/${id}/restitution`, { method: 'DELETE' }),
      await b.requete(`/api/gestion/fin-bail/locations/${id}/regularisations`, {
        corps: { annee: 2025 },
      }),
      await b.requete('/api/gestion/fin-bail/regularisations/r1/reglee', {
        corps: { regleeLe: '2026-12-10' },
      }),
      await b.requete(`/api/gestion/fin-bail/locations/${id}/colocataires`, {
        corps: { arrivee: { locataire: LEA, date: '2026-12-01' } },
      }),
      await b.requete('/api/gestion/fin-bail/decomptes/inconnu'),
    ];
    for (const r of indisponibles) {
      expect(r.status).toBe(503);
      expect(await r.json()).toEqual({ code: 'FIN_BAIL_INDISPONIBLE' });
    }
    expect(b.journal.evenements.some((e) => e.evenement === 'fin-bail.indisponible')).toBe(true);
    // Les journaux ne portent ni nom, ni adresse, ni montant.
    expect(JSON.stringify(b.journal.evenements)).not.toMatch(/Julie|Lices|65000|Paradis/);
    expect(bien.nom).toBe('T2 Lices');

    appliquerMigrations(b.sqlite);
    expect((await etat(b)).status).toBe(200);
  });

  it('sans les tables de gestion : 503 GESTION_INDISPONIBLE ; une panne inconnue : 500', async () => {
    const vide = await connecte(undefined, 1);
    const r = await vide.requete('/api/gestion/fin-bail/locations/l1/charges', {
      method: 'PUT',
      corps: { mode: 'provision' },
    });
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ code: 'GESTION_INDISPONIBLE' });

    const panne = (): Promise<never> => Promise.reject(new Error('panne'));
    const enPanne = {
      etat: panne,
      enregistrerConge: panne,
      retirerConge: panne,
      enregistrerModeCharges: panne,
      restituer: panne,
      rendreDepot: panne,
      annulerRestitution: panne,
      regulariser: panne,
      reglerRegularisation: panne,
      changerColocataire: panne,
      decompte: panne,
    } as unknown as DepotFinBail;
    const casse = bancD1({ surcharges: { finBail: enPanne } });
    await connecter(casse, CAMILLE);
    const erreur = await etat(casse);
    expect(erreur.status).toBe(500);
    expect(await erreur.json()).toEqual({ code: 'ERREUR_INTERNE' });
  });

  it('détection des tables absentes, erreur métier, panne de lecture des mouvements', async () => {
    expect(estTableFinBailAbsente(new Error('no such table: gestion_conge'))).toBe(true);
    expect(estTableFinBailAbsente(new Error('no such table: gestion_depense'))).toBe(true);
    expect(estTableFinBailAbsente(new Error('no such table: gestion_location'))).toBe(false);
    expect(estTableFinBailAbsente('no such table: gestion_decompte')).toBe(false);
    expect(new ErreurFinBail('INTROUVABLE')).toMatchObject({
      name: 'ErreurFinBail',
      code: 'INTROUVABLE',
    });
    const casse = (() => ({
      all: () => Promise.reject(new Error('panne')),
    })) as unknown as Lier;
    await expect(mouvementsSiDisponibles(casse, 'u1', 'l1')).rejects.toThrow('panne');
  });
});

describe('congé et préavis', () => {
  it('enregistre la sortie ; l’état le liste ; « Annuler le congé » la retire', async () => {
    const b = await connecte();
    const { location } = await creer(b);
    const id = location?.id ?? '';
    const r = await conge(b, id, CONGE);
    expect(r.status).toBe(200);
    const { conge: enregistre, location: modifiee } = await lire<CongeEnregistre>(r);
    expect(enregistre).toEqual({ locationId: id, ...CONGE, modifieLe: MAINTENANT });
    expect(modifiee.fin).toBe('2027-01-05');
    expect((await lire<EtatFinBail>(await etat(b))).conges).toEqual([enregistre]);

    // Modifier le congé déplace la sortie.
    const plusTard = { recuLe: '2026-12-05', fin: '2027-02-28', reduit: true };
    expect((await conge(b, id, plusTard)).status).toBe(200);
    expect((await lire<EtatFinBail>(await etat(b))).conges[0]).toMatchObject({
      fin: '2027-02-28',
      reduit: true,
    });

    const retire = await b.requete(`/api/gestion/fin-bail/locations/${id}/conge`, {
      method: 'DELETE',
    });
    expect(retire.status).toBe(200);
    expect((await lire<{ location: { fin?: string } }>(retire)).location.fin).toBeUndefined();
    expect((await lire<EtatFinBail>(await etat(b))).conges).toEqual([]);
    expect(
      (await b.requete(`/api/gestion/fin-bail/locations/${id}/conge`, { method: 'DELETE' })).status,
    ).toBe(404);
  });

  it('refus : reçu demain, reçu avant l’entrée, fin avant la réception, loyers reçus après, autre compte', async () => {
    const b = await connecte();
    const { location } = await creer(b);
    const id = location?.id ?? '';
    const demain = await conge(b, id, { ...CONGE, recuLe: '2026-12-16' });
    expect(demain.status).toBe(400);
    expect(await demain.json()).toEqual({ code: 'DATE_INVALIDE' });
    const avant = await conge(b, id, { recuLe: '2026-09-01', fin: '2026-12-01', reduit: false });
    expect(avant.status).toBe(400);
    expect(await avant.json()).toEqual({ code: 'CONGE_INVALIDE' });
    expect((await conge(b, id, { ...CONGE, fin: '2026-12-01' })).status).toBe(400);

    const paiement = { locationId: id, periode: '2027-03', montant: 70_000, date: '2026-12-05' };
    expect((await b.requete('/api/gestion/paiements', { corps: paiement })).status).toBe(201);
    const apres = await conge(b, id, CONGE);
    expect(apres.status).toBe(409);
    expect(await apres.json()).toEqual({ code: 'PAIEMENTS_APRES_SORTIE' });

    const sansOrigine = await b.requete(`/api/gestion/fin-bail/locations/${id}/conge`, {
      method: 'PUT',
      corps: CONGE,
      origine: null,
    });
    expect(sansOrigine.status).toBe(403);
    const autre = await connecte(b.sqlite);
    expect((await conge(autre, id, CONGE)).status).toBe(404);
  });
});

describe('mode des charges', () => {
  it('forfait ou provision ; refus : mode inconnu, autre compte', async () => {
    const b = await connecte();
    const { location } = await creer(b);
    const id = location?.id ?? '';
    const chemin = `/api/gestion/fin-bail/locations/${id}/charges`;
    const r = await b.requete(chemin, { method: 'PUT', corps: { mode: 'forfait' } });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ locationId: id, mode: 'forfait', modifieLe: MAINTENANT });
    expect((await lire<EtatFinBail>(await etat(b))).charges).toEqual([
      { locationId: id, mode: 'forfait', modifieLe: MAINTENANT },
    ]);
    expect((await b.requete(chemin, { method: 'PUT', corps: { mode: 'reel' } })).status).toBe(400);
    // Sans horloge fournie : l'heure réelle.
    const compte = b.sqlite.prepare('select id from "user" where email = ?').get(CAMILLE);
    const reel = await depotFinBailD1(d1SurSqlite(b.sqlite).base).enregistrerModeCharges(
      String(compte?.id),
      id,
      'provision',
    );
    expect(reel.modifieLe).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const autre = await connecte(b.sqlite);
    expect(
      (await autre.requete(chemin, { method: 'PUT', corps: { mode: 'forfait' } })).status,
    ).toBe(404);
  });
});

describe('changement de colocataire', () => {
  function changer(b: BancD1, id: string, corps: object): Promise<Response> {
    return b.requete(`/api/gestion/fin-bail/locations/${id}/colocataires`, { corps });
  }

  it('Julie part, Hugo arrive : la location continue et les quittances suivantes portent les présents', async () => {
    const b = await connecte();
    const { location } = await creer(b, { ...creation(), colocataires: [LEA] });
    const id = location?.id ?? '';
    await b.requete('/api/gestion/bailleur', {
      method: 'PUT',
      corps: { nom: 'Camille Roux', adresse: '3 rue Paradis, 13006 Marseille' },
    });
    const r = await changer(b, id, {
      depart: { locataireId: location?.locataireId, date: '2027-01-10' },
      arrivee: { locataire: HUGO, date: '2027-01-11' },
    });
    expect(r.status).toBe(201);
    const change = await lire<ColocataireChange>(r);
    expect(change.locataire).toMatchObject({ prenom: 'Hugo', nom: 'Petit' });
    expect(change.location.colocataireIds).toHaveLength(2);
    expect(change.mouvements.map((m) => m.sens)).toEqual(['depart', 'arrivee']);
    expect((await lire<EtatFinBail>(await etat(b))).mouvements).toHaveLength(2);

    for (const periode of ['2027-01', '2027-02']) {
      const paiement = { locationId: id, periode, montant: 70_000, date: '2026-12-05' };
      expect((await b.requete('/api/gestion/paiements', { corps: paiement })).status).toBe(201);
      const quittance = await b.requete('/api/gestion/documents', {
        corps: { type: 'quittance', locationId: id, periode },
      });
      expect(quittance.status).toBe(201);
      const noms = (await lire<DocumentComplet>(quittance)).contenu.locataires.map((l) => l.prenom);
      expect(noms).toEqual(periode === '2027-01' ? ['Julie', 'Léa', 'Hugo'] : ['Léa', 'Hugo']);
    }
  });

  it('refus : dernier locataire, dix colocataires, corps invalide, autre compte', async () => {
    const b = await connecte();
    const { location } = await creer(b);
    const seule = location?.id ?? '';
    const dernier = await changer(b, seule, {
      depart: { locataireId: location?.locataireId, date: '2026-12-01' },
    });
    expect(dernier.status).toBe(409);
    expect(await dernier.json()).toEqual({ code: 'COLOCATAIRE_REFUSE' });

    const pleine = await creer(b, {
      ...creation(),
      colocataires: Array.from({ length: 10 }, () => LEA),
    });
    const limite = await changer(b, pleine.location?.id ?? '', {
      arrivee: { locataire: HUGO, date: '2026-12-01' },
    });
    expect(limite.status).toBe(409);
    expect(await limite.json()).toEqual({ code: 'LIMITE_ATTEINTE' });

    expect((await changer(b, seule, {})).status).toBe(400);
    const autre = await connecte(b.sqlite);
    expect(
      (await changer(autre, seule, { arrivee: { locataire: HUGO, date: '2026-12-01' } })).status,
    ).toBe(404);
    expect((await b.requete('/api/gestion/fin-bail/decomptes/inconnu')).status).toBe(404);
  });
});
