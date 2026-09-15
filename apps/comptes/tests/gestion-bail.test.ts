import type { D1Database } from '@cloudflare/workers-types';
import type {
  CreationLocation,
  CreationReponse,
  EtatBail,
  LegalBien,
  LettreRevisionComplete,
  NouvelleLocation,
  RevisionAppliquee,
  RevisionLocation,
} from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import { d1SurSqlite } from '../scripts/d1-sqlite';
import { appliquerMigrations, MIGRATIONS } from '../scripts/migration';
import { ErreurBail, estTableBailAbsente, type DepotBail } from '../src/gestion/bail/depot';
import { depotBailD1 } from '../src/gestion/bail/depot-d1';
import { lireInstantane } from '../src/gestion/bail/lignes';
import { bancD1, compter, connecter, type BancD1 } from './aide';

const CAMILLE = 'camille@example.org';
const MAINTENANT = '2026-09-01T09:00:00.000Z';
const HORLOGE = { maintenant: () => MAINTENANT };
const BAILLEUR = { nom: 'Camille Roux', adresse: '3 rue Paradis, 13006 Marseille' };

const LOCATION: NouvelleLocation = {
  type: 'meublee',
  debut: '2025-10-01',
  jourLoyer: 5,
  loyerHorsCharges: 65_000,
  charges: 5_000,
  depot: 130_000,
};

function creation(dpe = 'D', location: NouvelleLocation = LOCATION): CreationLocation {
  return {
    bien: {
      nom: 'T2 Lices',
      adresse: '12 rue des Lices, Marseille',
      codePostal: '13005',
      type: 'appartement',
      meuble: true,
      projetId: 'projet-1',
      projet: { bien: { dpe, surface: 38 } },
    },
    locataire: { prenom: 'Julie', nom: 'Martin' },
    location,
  };
}

async function lire<T>(reponse: Response): Promise<T> {
  return (await reponse.json()) as T;
}

async function connecte(maintenant = MAINTENANT, sqlite?: BancD1['sqlite']): Promise<BancD1> {
  const b = bancD1({
    optionsDepot: { maintenant: () => maintenant },
    ...(sqlite === undefined ? {} : { sqlite }),
  });
  await connecter(b, sqlite === undefined ? CAMILLE : 'antoine.dupont@example.org');
  return b;
}

async function creer(b: BancD1, c: CreationLocation = creation()): Promise<CreationReponse> {
  const r = await b.requete('/api/gestion/locations', { corps: c });
  expect(r.status).toBe(201);
  return lire<CreationReponse>(r);
}

async function avecBailleur(b: BancD1): Promise<void> {
  expect(
    (await b.requete('/api/gestion/bailleur', { method: 'PUT', corps: BAILLEUR })).status,
  ).toBe(200);
}

function appliquer(b: BancD1, locationId: string, anniversaire = '2026-10-01'): Promise<Response> {
  return b.requete(`/api/gestion/bail/locations/${locationId}/revision/appliquer`, {
    corps: { anniversaire },
  });
}

function idUtilisateur(b: BancD1): string {
  return String(b.sqlite.prepare('select id from "user" where email = ?').get(CAMILLE)?.id);
}

/** Une D1 dont certaines lectures ne voient rien, les `fois` premières fois (course simulée). */
function masquee(d1: D1Database, regles: Record<string, number>): D1Database {
  const restantes = new Map(Object.entries(regles));
  return {
    prepare: (sql: string) => {
      const fois = restantes.get(sql) ?? 0;
      if (fois > 0) {
        restantes.set(sql, fois - 1);
        return { bind: () => ({ all: () => Promise.resolve({ results: [] }) }) };
      }
      return d1.prepare(sql);
    },
    batch: (instructions: Parameters<D1Database['batch']>[0]) => d1.batch(instructions),
  } as unknown as D1Database;
}

describe('migration sans risque : base sans 0008', () => {
  const avant0008 = MIGRATIONS.findIndex((m) => m.fichier.startsWith('0008'));

  it('les routes existantes répondent comme avant ; celles du bail rendent 503 ; migrée, elles marchent', async () => {
    const b = bancD1({ optionsDepot: HORLOGE, migrations: avant0008 });
    await connecter(b, CAMILLE);
    const { location } = await creer(b);
    const id = location?.id ?? '';
    expect((await b.requete('/api/gestion/etat')).status).toBe(200);
    await avecBailleur(b);
    const paiement = { locationId: id, periode: '2026-09', montant: 70_000, date: '2026-09-01' };
    expect((await b.requete('/api/gestion/paiements', { corps: paiement })).status).toBe(201);
    const quittance = { type: 'quittance', locationId: id, periode: '2026-09' };
    expect((await b.requete('/api/gestion/documents', { corps: quittance })).status).toBe(201);
    const montants = { aPartirDe: '2026-11', loyerHorsCharges: 66_000, charges: 5_000, apl: 0 };
    const modifier = { method: 'PATCH' as const, corps: { montants } };
    expect((await b.requete(`/api/gestion/locations/${id}`, modifier)).status).toBe(200);
    expect((await b.requete('/api/gestion/export')).status).toBe(200);

    const indisponibles = [
      await b.requete('/api/gestion/bail'),
      await b.requete(`/api/gestion/bail/biens/${location?.bienId ?? ''}`, {
        method: 'PUT',
        corps: { dpeClasse: 'D', dpeDate: null, zoneTendue: null },
      }),
      await b.requete(`/api/gestion/bail/locations/${id}/revision`, {
        method: 'PUT',
        corps: {
          active: true,
          anniversaire: '2025-10-01',
          trimestre: '2025-T2',
          formeBail: 'classique',
        },
      }),
      await appliquer(b, id),
      await b.requete('/api/gestion/bail/lettres/inconnue'),
    ];
    for (const r of indisponibles) {
      expect(r.status).toBe(503);
      expect(await r.json()).toEqual({ code: 'BAIL_INDISPONIBLE' });
    }
    expect(b.journal.evenements.some((e) => e.evenement === 'bail.indisponible')).toBe(true);
    // Les journaux ne portent ni montant, ni nom, ni adresse.
    expect(JSON.stringify(b.journal.evenements)).not.toMatch(/Julie|Lices|65000|Paradis/);

    appliquerMigrations(b.sqlite);
    expect((await b.requete('/api/gestion/bail')).status).toBe(200);
  });

  it('sans les tables de gestion : 503 GESTION_INDISPONIBLE ; une panne inconnue : 500', async () => {
    const vide = bancD1({ migrations: 1 });
    await connecter(vide, CAMILLE);
    const r = await vide.requete('/api/gestion/bail/biens/b1', {
      method: 'PUT',
      corps: { dpeClasse: null, dpeDate: null, zoneTendue: null },
    });
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ code: 'GESTION_INDISPONIBLE' });

    const panne = (): Promise<never> => Promise.reject(new Error('panne'));
    const enPanne: DepotBail = {
      etat: panne,
      enregistrerBien: panne,
      enregistrerRevision: panne,
      appliquerRevision: panne,
      lettre: panne,
    };
    const casse = bancD1({ surcharges: { bail: enPanne } });
    await connecter(casse, CAMILLE);
    const erreur = await casse.requete('/api/gestion/bail');
    expect(erreur.status).toBe(500);
    expect(await erreur.json()).toEqual({ code: 'ERREUR_INTERNE' });
  });

  it('détection des tables absentes et erreur métier', () => {
    expect(estTableBailAbsente(new Error('no such table: gestion_location_revision'))).toBe(true);
    expect(estTableBailAbsente(new Error('no such table: gestion_bien'))).toBe(false);
    expect(estTableBailAbsente('no such table: gestion_bail_lettre')).toBe(false);
    expect(new ErreurBail('INTROUVABLE')).toMatchObject({
      name: 'ErreurBail',
      code: 'INTROUVABLE',
    });
    expect(lireInstantane('{"bien":{"dpe":"D"}}')).toEqual({ bien: { dpe: 'D' } });
    expect(lireInstantane('[1]')).toBeUndefined();
    expect(lireInstantane('{abîmé')).toBeUndefined();
    expect(lireInstantane(null)).toBeUndefined();
  });
});

describe('caractéristiques légales du bien', () => {
  it('enregistrer, relire, effacer ; refus : corps invalide, autre compte, sans Origin', async () => {
    const b = await connecte();
    const { bien } = await creer(b);
    const chemin = `/api/gestion/bail/biens/${bien.id}`;
    const saisie = { dpeClasse: 'G', dpeDate: '2016-06-01', zoneTendue: true };
    const r = await b.requete(chemin, { method: 'PUT', corps: saisie });
    expect(r.status).toBe(200);
    const attendu: LegalBien = {
      bienId: bien.id,
      ...saisie,
      dpeClasse: 'G',
      modifieLe: MAINTENANT,
    };
    expect(await r.json()).toEqual(attendu);
    expect((await lire<EtatBail>(await b.requete('/api/gestion/bail'))).biens).toEqual([attendu]);

    const inconnus = { dpeClasse: null, dpeDate: null, zoneTendue: false };
    expect((await b.requete(chemin, { method: 'PUT', corps: inconnus })).status).toBe(200);
    expect((await lire<EtatBail>(await b.requete('/api/gestion/bail'))).biens).toEqual([
      { bienId: bien.id, ...inconnus, modifieLe: MAINTENANT },
    ]);
    const rien = { dpeClasse: null, dpeDate: null, zoneTendue: null };
    await b.requete(chemin, { method: 'PUT', corps: rien });
    // Sans horloge fournie : l'heure réelle.
    const reel = await depotBailD1(d1SurSqlite(b.sqlite).base).enregistrerBien(
      idUtilisateur(b),
      bien.id,
      rien,
    );
    expect(reel.modifieLe).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(
      (await lire<EtatBail>(await b.requete('/api/gestion/bail'))).biens[0]?.zoneTendue,
    ).toBeNull();

    expect((await b.requete(chemin, { method: 'PUT', corps: { dpeClasse: 'H' } })).status).toBe(
      400,
    );
    const sansOrigine = await b.requete(chemin, { method: 'PUT', corps: rien, origine: null });
    expect(sansOrigine.status).toBe(403);
    const autre = await connecte(MAINTENANT, b.sqlite);
    expect((await autre.requete(chemin, { method: 'PUT', corps: saisie })).status).toBe(404);
    expect(
      (await autre.requete('/api/gestion/bail/biens/inconnu', { method: 'PUT', corps: saisie }))
        .status,
    ).toBe(404);
    expect((await lire<EtatBail>(await autre.requete('/api/gestion/bail'))).biens).toEqual([]);
  });
});

describe('réglages de révision', () => {
  it('enregistrer ; refus : invalide, autre compte', async () => {
    const b = await connecte();
    const { location } = await creer(b);
    const chemin = `/api/gestion/bail/locations/${location?.id ?? ''}/revision`;
    const saisie = {
      active: false,
      anniversaire: '2025-10-01',
      trimestre: '2025-T2',
      formeBail: 'mobilite',
    };
    const r = await b.requete(chemin, { method: 'PUT', corps: saisie });
    expect(r.status).toBe(200);
    const attendu: RevisionLocation = {
      locationId: location?.id ?? '',
      ...saisie,
      formeBail: 'mobilite',
      derniereRevision: null,
      modifieLe: MAINTENANT,
    };
    expect(await r.json()).toEqual(attendu);
    expect((await lire<EtatBail>(await b.requete('/api/gestion/bail'))).revisions).toEqual([
      attendu,
    ]);
    expect(
      (await b.requete(chemin, { method: 'PUT', corps: { ...saisie, trimestre: '2025-T9' } }))
        .status,
    ).toBe(400);
    const autre = await connecte(MAINTENANT, b.sqlite);
    expect((await autre.requete(chemin, { method: 'PUT', corps: saisie })).status).toBe(404);
  });
});

describe('appliquer la révision', () => {
  it('650 € → 657,49 € à partir d’octobre : changement, lettre figée, référence mise à jour ; une seule lettre', async () => {
    const b = await connecte();
    const colocation = { ...creation(), location: { ...LOCATION, libelle: 'Chambre 2' } };
    const { location } = await creer(b, {
      ...colocation,
      colocataires: [{ prenom: 'Léa', nom: 'Bernard' }],
    });
    const id = location?.id ?? '';

    const sansBailleur = await appliquer(b, id);
    expect(sansBailleur.status).toBe(409);
    expect(await sansBailleur.json()).toEqual({ code: 'BAILLEUR_MANQUANT' });
    await avecBailleur(b);
    expect((await appliquer(b, id, '2027-10-01')).status).toBe(409);
    expect(
      (await b.requete(`/api/gestion/bail/locations/${id}/revision/appliquer`, { corps: {} }))
        .status,
    ).toBe(400);

    const r = await appliquer(b, id);
    expect(r.status).toBe(201);
    const { lettre, revision, location: modifiee } = await lire<RevisionAppliquee>(r);
    expect(lettre.contenu).toMatchObject({
      numero: expect.stringMatching(/^V-202610-/) as unknown,
      emisLe: '2026-09-01',
      bailleur: BAILLEUR,
      locataires: [
        { prenom: 'Julie', nom: 'Martin' },
        { prenom: 'Léa', nom: 'Bernard' },
      ],
      logement: { nom: 'T2 Lices', adresse: '12 rue des Lices, Marseille', libelle: 'Chambre 2' },
      anniversaire: '2026-10-01',
      aPartirDe: '2026-10',
      loyerActuel: 65_000,
      nouveauLoyer: 65_749,
      indiceAncien: { trimestre: '2025-T2', valeur: 14_668 },
      indiceNouveau: { trimestre: '2026-T2', valeur: 14_837, publieLe: '2026-07-10' },
      variationPourcent: 1.15,
    });
    expect(revision).toMatchObject({
      trimestre: '2026-T2',
      derniereRevision: '2026-10-01',
      active: true,
    });
    expect(modifiee.changements).toEqual([
      { aPartirDe: '2026-10', loyerHorsCharges: 65_749, charges: 5_000, apl: 0 },
    ]);

    const encore = await appliquer(b, id);
    expect(encore.status).toBe(200);
    expect((await lire<RevisionAppliquee>(encore)).lettre.id).toBe(lettre.id);
    const etat = await lire<EtatBail>(await b.requete('/api/gestion/bail'));
    expect(etat.lettres).toEqual([
      {
        id: lettre.id,
        locationId: id,
        numero: lettre.numero,
        anniversaire: '2026-10-01',
        emisLe: MAINTENANT,
      },
    ]);
    expect(
      await lire<LettreRevisionComplete>(await b.requete(`/api/gestion/bail/lettres/${lettre.id}`)),
    ).toEqual(lettre);
    expect(compter(b.sqlite, 'gestion_bail_lettre')).toBe(1);

    // Changer les réglages garde la dernière révision appliquée.
    const reglages = {
      active: true,
      anniversaire: '2025-10-01',
      trimestre: '2026-T2',
      formeBail: 'etudiant',
    };
    const apres = await b.requete(`/api/gestion/bail/locations/${id}/revision`, {
      method: 'PUT',
      corps: reglages,
    });
    expect(await apres.json()).toMatchObject({
      derniereRevision: '2026-10-01',
      formeBail: 'etudiant',
    });

    const autre = await connecte(MAINTENANT, b.sqlite);
    expect((await appliquer(autre, id)).status).toBe(404);
    expect((await autre.requete(`/api/gestion/bail/lettres/${lettre.id}`)).status).toBe(404);
  });

  it('DPE : G de l’analyse gèle la révision ; D enregistré par le bailleur l’emporte', async () => {
    const b = await connecte();
    const { bien, location } = await creer(b, creation('G'));
    const id = location?.id ?? '';
    await avecBailleur(b);
    const gelee = await appliquer(b, id);
    expect(gelee.status).toBe(409);
    expect(await gelee.json()).toEqual({ code: 'REVISION_IMPOSSIBLE' });
    await b.requete(`/api/gestion/bail/biens/${bien.id}`, {
      method: 'PUT',
      corps: { dpeClasse: 'D', dpeDate: null, zoneTendue: null },
    });
    expect((await appliquer(b, id)).status).toBe(201);
  });

  it('jamais rétroactif : octobre déjà payé, le nouveau loyer vaut à partir de novembre', async () => {
    const b = await connecte();
    const { location } = await creer(b);
    const id = location?.id ?? '';
    await avecBailleur(b);
    const paiement = { locationId: id, periode: '2026-10', montant: 70_000, date: '2026-09-01' };
    expect((await b.requete('/api/gestion/paiements', { corps: paiement })).status).toBe(201);
    const { location: modifiee } = await lire<RevisionAppliquee>(await appliquer(b, id));
    expect(modifiee.changements?.[0]?.aPartirDe).toBe('2026-11');
  });

  it('mois d’effet après la sortie : 400 HORS_LOCATION ; 120 changements : 409 LIMITE_ATTEINTE', async () => {
    const b = await connecte('2026-09-20T09:00:00.000Z');
    // Entrée le 10 : référence T2 2025 ; anniversaire le 10/10/2026, effet en novembre, sortie le 20 octobre.
    const courte = { ...LOCATION, debut: '2025-10-10', fin: '2026-10-20' };
    const { location } = await creer(b, creation('D', courte));
    await avecBailleur(b);
    const hors = await appliquer(b, location?.id ?? '', '2026-10-10');
    expect(hors.status).toBe(400);
    expect(await hors.json()).toEqual({ code: 'HORS_LOCATION' });

    const { location: pleine } = await creer(b);
    const id = pleine?.id ?? '';
    const inserer = b.sqlite.prepare(
      'insert into gestion_changement (locationId, userId, aPartirDe, loyerHorsCharges, charges, apl, modifieLe) values (?, ?, ?, ?, ?, ?, ?)',
    );
    for (let i = 0; i < 120; i += 1) {
      const mois = `${String(2030 + Math.floor(i / 12))}-${String((i % 12) + 1).padStart(2, '0')}`;
      inserer.run(id, idUtilisateur(b), mois, 65_000, 5_000, 0, MAINTENANT);
    }
    const limite = await appliquer(b, id);
    expect(limite.status).toBe(409);
    expect(await limite.json()).toEqual({ code: 'LIMITE_ATTEINTE' });
  });

  it('course : un paiement arrivé pendant le calcul → PERIODE_PAYEE, rien n’est écrit', async () => {
    const b = await connecte();
    const { location } = await creer(b);
    const id = location?.id ?? '';
    await avecBailleur(b);
    const paiement = { locationId: id, periode: '2026-10', montant: 70_000, date: '2026-09-01' };
    await b.requete('/api/gestion/paiements', { corps: paiement });
    const d1 = masquee(d1SurSqlite(b.sqlite).base, {
      'select * from gestion_paiement where userId = ? and locationId = ?': 1,
    });
    const options = { ...HORLOGE, genererId: () => 'lettre-en-course' };
    await expect(
      depotBailD1(d1, options).appliquerRevision(idUtilisateur(b), id, '2026-10-01'),
    ).rejects.toThrow(new ErreurBail('PERIODE_PAYEE'));
    expect(compter(b.sqlite, 'gestion_bail_lettre')).toBe(0);
    expect(compter(b.sqlite, 'gestion_changement')).toBe(0);
    expect(compter(b.sqlite, 'gestion_location_revision')).toBe(0);
  });

  it('course : deux onglets appliquent ensemble → la première lettre fait foi', async () => {
    const b = await connecte();
    const { location } = await creer(b);
    const id = location?.id ?? '';
    await avecBailleur(b);
    const premiere = await lire<RevisionAppliquee>(await appliquer(b, id));
    // Le second onglet a tout lu avant que le premier écrive.
    const d1 = masquee(d1SurSqlite(b.sqlite).base, {
      'select * from gestion_bail_lettre where userId = ? and cle = ?': 1,
      'select * from gestion_location_revision where userId = ? and locationId = ?': 1,
      'select aPartirDe, loyerHorsCharges, charges, apl from gestion_changement where userId = ? and locationId = ? order by aPartirDe': 1,
    });
    const seconde = await depotBailD1(d1, HORLOGE).appliquerRevision(
      idUtilisateur(b),
      id,
      '2026-10-01',
    );
    expect(seconde.nouvelle).toBe(false);
    expect(seconde.resultat.lettre).toEqual(premiere.lettre);
    expect(compter(b.sqlite, 'gestion_bail_lettre')).toBe(1);
  });

  it('suppression du bien ou du compte : DPE, révision et lettre partent avec', async () => {
    const b = await connecte();
    const { bien, location } = await creer(b);
    await avecBailleur(b);
    await b.requete(`/api/gestion/bail/biens/${bien.id}`, {
      method: 'PUT',
      corps: { dpeClasse: 'D', dpeDate: null, zoneTendue: null },
    });
    await appliquer(b, location?.id ?? '');
    const tables = ['gestion_bien_legal', 'gestion_location_revision', 'gestion_bail_lettre'];
    expect(tables.map((t) => compter(b.sqlite, t))).toEqual([1, 1, 1]);
    expect((await b.requete(`/api/gestion/biens/${bien.id}`, { method: 'DELETE' })).status).toBe(
      204,
    );
    expect(tables.map((t) => compter(b.sqlite, t))).toEqual([0, 0, 0]);

    const { bien: autreBien, location: autreLocation } = await creer(b);
    await b.requete(`/api/gestion/bail/biens/${autreBien.id}`, {
      method: 'PUT',
      corps: { dpeClasse: 'D', dpeDate: null, zoneTendue: null },
    });
    await appliquer(b, autreLocation?.id ?? '');
    b.sqlite.prepare('delete from "user" where id = ?').run(idUtilisateur(b));
    expect(tables.map((t) => compter(b.sqlite, t))).toEqual([0, 0, 0]);
  });
});
