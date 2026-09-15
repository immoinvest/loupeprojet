import type {
  CreationLocation,
  CreationReponse,
  Depense,
  EtatArgent,
  NouvelleDepense,
  PretBien,
  PretEnregistre,
} from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import { appliquerMigrations } from '../scripts/migration';
import type { DepotArgent } from '../src/gestion/argent/depot';
import { bancD1, compter, connecter, type OptionsBancD1 } from './aide';

type Banc = ReturnType<typeof bancD1>;

const CAMILLE = 'camille@example.org';
const HORLOGE = '2026-10-20T09:00:00.000Z';

const LICES: CreationLocation = {
  bien: { nom: 'T2 Lices', adresse: '12 rue des Lices', type: 'appartement', meuble: true },
  locataire: { prenom: 'Julie', nom: 'Martin' },
  location: {
    type: 'meublee',
    debut: '2026-10-01',
    jourLoyer: 5,
    loyerHorsCharges: 65_000,
    charges: 5_000,
    depot: 130_000,
  },
};

const PRET: PretBien = {
  capital: 15_000_000,
  tauxAnnuel: 0.0335,
  dureeMois: 300,
  debut: '2026-11',
  assuranceMensuelle: 3_125,
};

function taxe(bienId: string | undefined): NouvelleDepense {
  return {
    ...(bienId === undefined ? {} : { bienId }),
    categorie: 'taxe_fonciere',
    montant: 84_000,
    date: '2026-10-15',
    libelle: 'Taxe foncière 2026',
    recuperable: false,
  };
}

async function lire<T>(reponse: Response): Promise<T> {
  return (await reponse.json()) as T;
}

async function connecte(options: OptionsBancD1 = {}): Promise<Banc> {
  const b = bancD1({
    optionsDepot: { maintenant: () => HORLOGE },
    optionsArgent: { maintenant: () => HORLOGE },
    ...options,
  });
  await connecter(b, CAMILLE);
  return b;
}

async function creerBien(b: Banc, creation: CreationLocation = LICES): Promise<CreationReponse> {
  const r = await b.requete('/api/gestion/locations', { corps: creation });
  expect(r.status).toBe(201);
  return lire<CreationReponse>(r);
}

function ajouter(b: Banc, depense: object): Promise<Response> {
  return b.requete('/api/gestion/depenses', { corps: depense });
}

async function autreCompte(b: Banc): Promise<Banc> {
  const autre = bancD1({ sqlite: b.sqlite });
  await connecter(autre, 'antoine.dupont@example.org');
  return autre;
}

describe('dépenses', () => {
  it('ajouter (201), lister, modifier (200), supprimer (204) ; une dépense récurrente reste une ligne', async () => {
    const b = await connecte();
    const { bien } = await creerBien(b);
    const r = await ajouter(b, { ...taxe(bien.id), recurrence: { frequence: 'annuelle' } });
    expect(r.status).toBe(201);
    const creee = await lire<Depense>(r);
    expect(creee).toMatchObject({
      bienId: bien.id,
      categorie: 'taxe_fonciere',
      montant: 84_000,
      recuperable: false,
      recurrence: { frequence: 'annuelle' },
      creeLe: HORLOGE,
    });

    const sansBien = await ajouter(b, {
      ...taxe(undefined),
      categorie: 'gestion',
      recuperable: true,
      recurrence: { frequence: 'mensuelle', jusquAu: '2027-06-30' },
    });
    expect(await lire<Depense>(sansBien)).not.toHaveProperty('bienId');

    const liste = await lire<Depense[]>(await b.requete('/api/gestion/depenses'));
    expect(liste).toHaveLength(2);
    expect(liste.find((d) => d.id !== creee.id)).toMatchObject({
      categorie: 'gestion',
      recuperable: true,
      recurrence: { frequence: 'mensuelle', jusquAu: '2027-06-30' },
    });

    const modifiee = await b.requete(`/api/gestion/depenses/${creee.id}`, {
      method: 'PATCH',
      corps: { ...taxe(undefined), montant: 91_000 },
    });
    expect(modifiee.status).toBe(200);
    const relue = await lire<Depense>(modifiee);
    expect(relue).toMatchObject({ id: creee.id, montant: 91_000, creeLe: HORLOGE });
    expect(relue).not.toHaveProperty('bienId');
    expect(relue).not.toHaveProperty('recurrence');

    const supprimee = await b.requete(`/api/gestion/depenses/${creee.id}`, { method: 'DELETE' });
    expect(supprimee.status).toBe(204);
    expect(compter(b.sqlite, 'gestion_depense')).toBe(1);
    const encore = await b.requete(`/api/gestion/depenses/${creee.id}`, { method: 'DELETE' });
    expect(encore.status).toBe(404);
  });

  it('refus : 400 champs invalides, 404 bien ou dépense d’un autre compte, 409 limite atteinte, 403 sans Origin', async () => {
    const b = await connecte({ optionsArgent: { limiteDepenses: 2 } });
    const { bien } = await creerBien(b);
    expect((await ajouter(b, { ...taxe(bien.id), montant: 0 })).status).toBe(400);
    expect((await ajouter(b, { brut: true })).status).toBe(400);
    expect((await b.requete('/api/gestion/depenses', { brut: '{' })).status).toBe(400);
    const inconnu = await ajouter(b, taxe('bien-inconnu'));
    expect(inconnu.status).toBe(404);
    expect(await inconnu.json()).toEqual({ code: 'INTROUVABLE' });

    const premiere = await lire<Depense>(await ajouter(b, taxe(bien.id)));
    expect((await ajouter(b, taxe(undefined))).status).toBe(201);
    const pleine = await ajouter(b, taxe(bien.id));
    expect(pleine.status).toBe(409);
    expect(await pleine.json()).toEqual({ code: 'LIMITE_ATTEINTE' });
    expect((await ajouter(b, taxe(undefined))).status).toBe(409);

    const sansOrigine = await b.requete('/api/gestion/depenses', {
      corps: taxe(bien.id),
      origine: null,
    });
    expect(sansOrigine.status).toBe(403);

    const autre = await autreCompte(b);
    expect(await autre.requete('/api/gestion/depenses').then(lire)).toEqual([]);
    expect((await ajouter(autre, taxe(bien.id))).status).toBe(404);
    const patch = await autre.requete(`/api/gestion/depenses/${premiere.id}`, {
      method: 'PATCH',
      corps: taxe(undefined),
    });
    expect(patch.status).toBe(404);
    expect(
      (await autre.requete(`/api/gestion/depenses/${premiere.id}`, { method: 'DELETE' })).status,
    ).toBe(404);
    // Modifier sa dépense vers le bien d'un autre compte : refusé, rien ne change.
    const { bien: sienne } = await creerBien(autre);
    const vol = await b.requete(`/api/gestion/depenses/${premiere.id}`, {
      method: 'PATCH',
      corps: taxe(sienne.id),
    });
    expect(vol.status).toBe(404);
    expect(
      (await b.requete(`/api/gestion/depenses/${premiere.id}`, { method: 'PATCH', corps: {} }))
        .status,
    ).toBe(400);
    expect(compter(b.sqlite, 'gestion_depense')).toBe(2);
  });
});

describe('prêt d’un bien', () => {
  it('aucun prêt (null), enregistrer, remplacer, supprimer ; l’état Argent rend dépenses et prêts', async () => {
    const b = await connecte();
    const { bien } = await creerBien(b);
    const chemin = `/api/gestion/biens/${bien.id}/pret`;
    expect(await lire(await b.requete(chemin))).toEqual({ pret: null });

    const r = await b.requete(chemin, { method: 'PUT', corps: PRET });
    expect(r.status).toBe(200);
    expect(await lire<PretEnregistre>(r)).toEqual({ ...PRET, bienId: bien.id, modifieLe: HORLOGE });
    const remplace = await b.requete(chemin, {
      method: 'PUT',
      corps: { ...PRET, tauxAnnuel: 0.031 },
    });
    expect((await lire<PretEnregistre>(remplace)).tauxAnnuel).toBe(0.031);
    expect(compter(b.sqlite, 'gestion_pret')).toBe(1);
    expect((await lire<{ pret: PretEnregistre }>(await b.requete(chemin))).pret.tauxAnnuel).toBe(
      0.031,
    );

    await ajouter(b, taxe(bien.id));
    const etat = await lire<EtatArgent>(await b.requete('/api/gestion/argent'));
    expect(etat.depenses).toHaveLength(1);
    expect(etat.prets).toEqual([
      { ...PRET, tauxAnnuel: 0.031, bienId: bien.id, modifieLe: HORLOGE },
    ]);

    expect((await b.requete(chemin, { method: 'DELETE' })).status).toBe(204);
    expect((await b.requete(chemin, { method: 'DELETE' })).status).toBe(404);
    expect(
      (await b.requete(chemin, { method: 'PUT', corps: { ...PRET, dureeMois: 0 } })).status,
    ).toBe(400);
  });

  it('bien d’un autre compte ou inconnu : 404 en lecture, en écriture et en suppression', async () => {
    const b = await connecte();
    const { bien } = await creerBien(b);
    const chemin = `/api/gestion/biens/${bien.id}/pret`;
    expect((await b.requete(chemin, { method: 'PUT', corps: PRET })).status).toBe(200);
    const autre = await autreCompte(b);
    expect((await autre.requete(chemin)).status).toBe(404);
    expect((await autre.requete(chemin, { method: 'PUT', corps: PRET })).status).toBe(404);
    expect((await autre.requete(chemin, { method: 'DELETE' })).status).toBe(404);
    expect(
      (await b.requete('/api/gestion/biens/inconnu/pret', { method: 'PUT', corps: PRET })).status,
    ).toBe(404);
    expect(await lire<{ pret: PretEnregistre }>(await b.requete(chemin))).toMatchObject({
      pret: { capital: PRET.capital },
    });
  });
});

describe('cascade, export et migration sans risque', () => {
  it('supprimer un bien retire ses dépenses et son prêt ; supprimer le compte retire tout', async () => {
    const b = await connecte();
    const { bien } = await creerBien(b);
    await ajouter(b, taxe(bien.id));
    await ajouter(b, taxe(undefined));
    await b.requete(`/api/gestion/biens/${bien.id}/pret`, { method: 'PUT', corps: PRET });

    expect((await b.requete(`/api/gestion/biens/${bien.id}`, { method: 'DELETE' })).status).toBe(
      204,
    );
    const etat = await lire<EtatArgent>(await b.requete('/api/gestion/argent'));
    expect(etat.prets).toEqual([]);
    expect(etat.depenses.map((d) => d.bienId)).toEqual([undefined]);

    expect((await b.requete('/api/auth/delete-user', { corps: {} })).status).toBe(200);
    expect(compter(b.sqlite, 'gestion_depense')).toBe(0);
    expect(compter(b.sqlite, 'gestion_pret')).toBe(0);
  });

  it('l’export ajoute dépenses et prêts', async () => {
    const b = await connecte();
    const { bien } = await creerBien(b);
    await ajouter(b, taxe(bien.id));
    await b.requete(`/api/gestion/biens/${bien.id}/pret`, { method: 'PUT', corps: PRET });
    const exporte = await lire<EtatArgent & { biens: unknown[] }>(
      await b.requete('/api/gestion/export'),
    );
    expect(exporte.biens).toHaveLength(1);
    expect(exporte.depenses).toHaveLength(1);
    expect(exporte.prets).toHaveLength(1);
  });

  it('base migrée jusqu’à 0006 : Gérer marche comme avant, les routes Argent rendent 503 ; 0007 appliquée, elles marchent', async () => {
    const b = await connecte({ migrations: 6 });
    const { bien, location } = await creerBien(b);
    expect((await b.requete('/api/gestion/etat')).status).toBe(200);
    const paye = await b.requete('/api/gestion/paiements', {
      corps: { locationId: location?.id, periode: '2026-10', montant: 70_000, date: '2026-10-05' },
    });
    expect(paye.status).toBe(201);
    const exporte = await b.requete('/api/gestion/export');
    expect(exporte.status).toBe(200);
    const corps = await lire<Record<string, unknown>>(exporte);
    expect(corps).not.toHaveProperty('depenses');
    expect(corps).not.toHaveProperty('prets');

    const chemin = `/api/gestion/biens/${bien.id}/pret`;
    const appels: [string, Parameters<Banc['requete']>[1]][] = [
      ['/api/gestion/argent', {}],
      ['/api/gestion/depenses', {}],
      ['/api/gestion/depenses', { corps: taxe(bien.id) }],
      ['/api/gestion/depenses/d1', { method: 'PATCH', corps: taxe(bien.id) }],
      ['/api/gestion/depenses/d1', { method: 'DELETE' }],
      [chemin, {}],
      [chemin, { method: 'PUT', corps: PRET }],
      [chemin, { method: 'DELETE' }],
    ];
    for (const [route, options] of appels) {
      const r = await b.requete(route, options);
      expect(r.status).toBe(503);
      expect(await r.json()).toEqual({ code: 'DEPENSES_INDISPONIBLE' });
    }
    expect(b.journal.evenements).toContainEqual({
      niveau: 'erreur',
      evenement: 'argent.indisponible',
      donnees: { chemin: '/api/gestion/argent' },
    });
    const journal = JSON.stringify(b.journal.evenements);
    expect(journal).not.toContain('84000');
    expect(journal).not.toContain('Taxe foncière');
    expect(journal).not.toContain(CAMILLE);

    appliquerMigrations(b.sqlite);
    expect((await ajouter(b, taxe(bien.id))).status).toBe(201);
    expect((await b.requete(chemin, { method: 'PUT', corps: PRET })).status).toBe(200);
    expect((await b.requete('/api/gestion/etat')).status).toBe(200);
  });

  it('une panne imprévue : 500 ERREUR_INTERNE sur les routes Argent et sur l’export', async () => {
    const panne = (): Promise<never> => Promise.reject(new Error('disque plein'));
    const enPanne: DepotArgent = {
      etat: panne,
      depenses: panne,
      ajouterDepense: panne,
      modifierDepense: panne,
      supprimerDepense: panne,
      pret: panne,
      enregistrerPret: panne,
      supprimerPret: panne,
      exporter: panne,
    };
    const b = await connecte({ surcharges: { argent: enPanne } });
    const r = await b.requete('/api/gestion/argent');
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ code: 'ERREUR_INTERNE' });
    expect((await b.requete('/api/gestion/export')).status).toBe(500);
  });

  it('sans session : 401 NON_CONNECTE sur les routes Argent', async () => {
    const b = bancD1();
    const r = await b.requete('/api/gestion/argent');
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ code: 'NON_CONNECTE' });
    expect((await ajouter(b, taxe(undefined))).status).toBe(401);
  });

  it('une ligne abîmée dans la base : l’export rend 500, jamais un export faux', async () => {
    const b = await connecte();
    const { bien } = await creerBien(b);
    expect((await ajouter(b, taxe(bien.id))).status).toBe(201);
    b.sqlite.prepare("update gestion_depense set categorie = 'inconnue'").run();
    expect((await b.requete('/api/gestion/export')).status).toBe(500);
    expect((await b.requete('/api/gestion/argent')).status).toBe(500);
  });
});
