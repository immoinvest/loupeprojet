import type {
  CreationLocation,
  CreationReponse,
  DecompteComplet,
  EtatFinBail,
  NouvelleLocation,
  RegularisationValidee,
  Restitution,
  RestitutionEnregistree,
} from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import { bancD1, compter, connecter, type BancD1 } from './aide';

const CAMILLE = 'camille@example.org';
/** Le 2 avril 2027, deux jours après la sortie de Julie. */
const MAINTENANT = '2027-04-02T09:00:00.000Z';
const BAILLEUR = { nom: 'Camille Roux', adresse: '3 rue Paradis, 13006 Marseille' };
const PEINTURE = { motif: 'Peinture de la chambre', montant: 12_000 };

const TERMINEE: NouvelleLocation = {
  type: 'meublee',
  debut: '2026-10-01',
  fin: '2027-03-31',
  jourLoyer: 5,
  loyerHorsCharges: 65_000,
  charges: 5_000,
  depot: 130_000,
};

function creation(location: NouvelleLocation = TERMINEE, nom = 'T2 Lices'): CreationLocation {
  return {
    bien: { nom, adresse: `12 rue des Lices, Marseille`, type: 'appartement', meuble: true },
    locataire: { prenom: 'Julie', nom: 'Martin' },
    location,
  };
}

async function lire<T>(reponse: Response): Promise<T> {
  return (await reponse.json()) as T;
}

async function connecte(sqlite?: BancD1['sqlite']): Promise<BancD1> {
  const b = bancD1({
    optionsDepot: { maintenant: () => MAINTENANT },
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

function restituer(b: BancD1, id: string, corps: object): Promise<Response> {
  return b.requete(`/api/gestion/fin-bail/locations/${id}/restitution`, { corps });
}

describe('restitution du dépôt de garantie', () => {
  const avecRetenues = { clesLe: '2027-03-31', conforme: false, retenues: [PEINTURE] };

  it('retenues : 1 180 € à rendre avant le 31 mai, décompte figé, une seule fois', async () => {
    const b = await connecte();
    const { location } = await creer(b);
    const id = location?.id ?? '';
    const sansBailleur = await restituer(b, id, avecRetenues);
    expect(sansBailleur.status).toBe(409);
    expect(await sansBailleur.json()).toEqual({ code: 'BAILLEUR_MANQUANT' });
    await avecBailleur(b);

    const r = await restituer(b, id, avecRetenues);
    expect(r.status).toBe(201);
    const { restitution, decompte } = await lire<RestitutionEnregistree>(r);
    expect(restitution).toMatchObject({
      locationId: id,
      clesLe: '2027-03-31',
      conforme: false,
      depot: 130_000,
      aRendre: 118_000,
      dateLimite: '2027-05-31',
      rendueLe: null,
    });
    expect(decompte.contenu).toMatchObject({
      type: 'restitution',
      numero: expect.stringMatching(/^D-202703-/) as unknown,
      bailleur: BAILLEUR,
      locataires: [{ prenom: 'Julie', nom: 'Martin' }],
      entree: '2026-10-01',
      sortie: '2027-03-31',
      totalRetenues: 12_000,
      aRendre: 118_000,
      dateLimite: '2027-05-31',
    });

    const encore = await restituer(b, id, avecRetenues);
    expect(encore.status).toBe(409);
    expect(await encore.json()).toEqual({ code: 'DEJA_ENREGISTRE' });
    expect(compter(b.sqlite, 'gestion_decompte')).toBe(1);

    const lu = await b.requete(`/api/gestion/fin-bail/decomptes/${decompte.id}`);
    expect(await lire<DecompteComplet>(lu)).toEqual(decompte);
    const etat = await lire<EtatFinBail>(await b.requete('/api/gestion/fin-bail'));
    expect(etat.restitutions).toEqual([restitution]);
    expect(etat.decomptes).toEqual([
      {
        id: decompte.id,
        type: 'restitution',
        locationId: id,
        numero: decompte.numero,
        emisLe: MAINTENANT,
      },
    ]);
  });

  it('« Rendu le » : date future ou avant les clés refusée ; ensuite le décompte ne s’annule plus', async () => {
    const b = await connecte();
    const { location } = await creer(b);
    const id = location?.id ?? '';
    await avecBailleur(b);
    expect((await restituer(b, id, avecRetenues)).status).toBe(201);
    const chemin = `/api/gestion/fin-bail/locations/${id}/restitution/rendue`;
    const demain = await b.requete(chemin, { corps: { rendueLe: '2027-04-03' } });
    expect(demain.status).toBe(400);
    expect(await demain.json()).toEqual({ code: 'DATE_INVALIDE' });
    expect((await b.requete(chemin, { corps: { rendueLe: '2027-03-30' } })).status).toBe(400);
    expect((await b.requete(chemin, { corps: {} })).status).toBe(400);

    const rendue = await b.requete(chemin, { corps: { rendueLe: '2027-04-01' } });
    expect(rendue.status).toBe(200);
    expect(await lire<Restitution>(rendue)).toMatchObject({ rendueLe: '2027-04-01' });
    const annuler = await b.requete(`/api/gestion/fin-bail/locations/${id}/restitution`, {
      method: 'DELETE',
    });
    expect(annuler.status).toBe(409);
    expect(await annuler.json()).toEqual({ code: 'DEPOT_RENDU' });

    const autre = await connecte(b.sqlite);
    expect((await autre.requete(chemin, { corps: { rendueLe: '2027-04-01' } })).status).toBe(404);
    expect((await restituer(autre, id, avecRetenues)).status).toBe(404);
  });

  it('état des lieux conforme : tout rendu sous un mois ; « Annuler » efface la restitution et son décompte', async () => {
    const b = await connecte();
    // Une chambre : le décompte porte son libellé.
    const { location } = await creer(b, creation({ ...TERMINEE, libelle: 'Chambre 2' }));
    const id = location?.id ?? '';
    await avecBailleur(b);
    const conforme = { clesLe: '2027-04-01', conforme: true, retenues: [] };
    const r = await restituer(b, id, conforme);
    expect(r.status).toBe(201);
    const { restitution, decompte } = await lire<RestitutionEnregistree>(r);
    expect(restitution).toMatchObject({ aRendre: 130_000, dateLimite: '2027-05-01' });
    expect(decompte.contenu.logement).toMatchObject({ nom: 'T2 Lices', libelle: 'Chambre 2' });

    const chemin = `/api/gestion/fin-bail/locations/${id}/restitution`;
    expect((await b.requete(chemin, { method: 'DELETE' })).status).toBe(204);
    expect(compter(b.sqlite, 'gestion_depot_restitution')).toBe(0);
    expect(compter(b.sqlite, 'gestion_decompte')).toBe(0);
    expect((await b.requete(chemin, { method: 'DELETE' })).status).toBe(404);
    expect((await restituer(b, id, conforme)).status).toBe(201);
  });

  it('refus : location en cours, clés remises demain, retenues au-delà du dépôt, corps invalide', async () => {
    const b = await connecte();
    await avecBailleur(b);
    const { location: enCours } = await creer(b, creation({ ...TERMINEE, fin: undefined }));
    const ouverte = await restituer(b, enCours?.id ?? '', avecRetenues);
    expect(ouverte.status).toBe(409);
    expect(await ouverte.json()).toEqual({ code: 'LOCATION_EN_COURS' });

    const { location } = await creer(b);
    const id = location?.id ?? '';
    const demain = await restituer(b, id, { ...avecRetenues, clesLe: '2027-04-03' });
    expect(demain.status).toBe(400);
    expect(await demain.json()).toEqual({ code: 'DATE_INVALIDE' });
    const trop = await restituer(b, id, {
      ...avecRetenues,
      retenues: [{ motif: 'Travaux', montant: 130_001 }],
    });
    expect(trop.status).toBe(409);
    expect(await trop.json()).toEqual({ code: 'RETENUES_TROP_ELEVEES' });
    expect((await restituer(b, id, { ...avecRetenues, conforme: true })).status).toBe(400);
  });
});

describe('régularisation annuelle des charges', () => {
  /** Julie depuis le 1er octobre 2025, 50 € de provisions par mois, 45 €/mois de charges de copropriété. */
  const DEPUIS_2025: NouvelleLocation = { ...TERMINEE, debut: '2025-10-01', fin: undefined };

  async function avecDepense(b: BancD1, bienId: string): Promise<void> {
    const depense = {
      bienId,
      categorie: 'copropriete',
      montant: 4_500,
      date: '2025-01-10',
      recuperable: true,
      recurrence: { frequence: 'mensuelle' },
    };
    expect((await b.requete('/api/gestion/depenses', { corps: depense })).status).toBe(201);
  }

  function regulariser(b: BancD1, id: string, annee: number): Promise<Response> {
    return b.requete(`/api/gestion/fin-bail/locations/${id}/regularisations`, { corps: { annee } });
  }

  it('2026 : 600 € de provisions contre 540 € de charges → 60 € à rembourser en juin 2027', async () => {
    const b = await connecte();
    const { bien, location } = await creer(b, creation(DEPUIS_2025));
    const id = location?.id ?? '';
    await avecBailleur(b);
    await avecDepense(b, bien.id);

    const r = await regulariser(b, id, 2026);
    expect(r.status).toBe(201);
    const { regularisation, decompte } = await lire<RegularisationValidee>(r);
    expect(regularisation).toMatchObject({
      locationId: id,
      annee: 2026,
      solde: -6_000,
      aPartirDe: '2027-06',
      regleeLe: null,
    });
    expect(decompte.contenu).toMatchObject({
      type: 'regularisation',
      numero: expect.stringMatching(/^C-2026-/) as unknown,
      annee: 2026,
      debut: '2026-01-01',
      fin: '2026-12-31',
      provisions: 60_000,
      charges: [{ categorie: 'copropriete', montant: 54_000 }],
      totalCharges: 54_000,
      joursOccupes: 365,
      chambres: 1,
      solde: -6_000,
      aPartirDe: '2027-06',
    });

    const encore = await regulariser(b, id, 2026);
    expect(encore.status).toBe(409);
    expect(await encore.json()).toEqual({ code: 'DEJA_ENREGISTRE' });
    expect(
      (await lire<EtatFinBail>(await b.requete('/api/gestion/fin-bail'))).regularisations,
    ).toEqual([regularisation]);

    const chemin = `/api/gestion/fin-bail/regularisations/${regularisation.id}/reglee`;
    expect((await b.requete(chemin, { corps: { regleeLe: '2027-04-03' } })).status).toBe(400);
    expect((await b.requete(chemin, { corps: {} })).status).toBe(400);
    const reglee = await b.requete(chemin, { corps: { regleeLe: '2027-04-01' } });
    expect(reglee.status).toBe(200);
    expect(await reglee.json()).toMatchObject({ regleeLe: '2027-04-01' });
    expect(
      (
        await b.requete('/api/gestion/fin-bail/regularisations/inconnue/reglee', {
          corps: { regleeLe: '2027-04-01' },
        })
      ).status,
    ).toBe(404);
    const autre = await connecte(b.sqlite);
    expect((await autre.requete(chemin, { corps: { regleeLe: '2027-04-01' } })).status).toBe(404);
    expect((await regulariser(autre, id, 2025)).status).toBe(404);
  });

  it('refus : année en cours, forfait, aucune dépense récupérable, corps invalide', async () => {
    const b = await connecte();
    const { bien, location } = await creer(b, creation(DEPUIS_2025));
    const id = location?.id ?? '';
    await avecBailleur(b);

    const courante = await regulariser(b, id, 2027);
    expect(courante.status).toBe(409);
    expect(await courante.json()).toEqual({ code: 'REGULARISATION_IMPOSSIBLE' });
    // Sans dépense récupérable, rien à régulariser.
    expect((await regulariser(b, id, 2026)).status).toBe(409);

    await avecDepense(b, bien.id);
    expect(
      (
        await b.requete(`/api/gestion/fin-bail/locations/${id}/charges`, {
          method: 'PUT',
          corps: { mode: 'forfait' },
        })
      ).status,
    ).toBe(200);
    const forfait = await regulariser(b, id, 2026);
    expect(forfait.status).toBe(409);
    expect(await forfait.json()).toEqual({ code: 'REGULARISATION_IMPOSSIBLE' });
    expect(
      (await b.requete(`/api/gestion/fin-bail/locations/${id}/regularisations`, { corps: {} }))
        .status,
    ).toBe(400);
  });
});

describe('suppression', () => {
  const TABLES = [
    'gestion_conge',
    'gestion_location_charges',
    'gestion_depot_restitution',
    'gestion_regularisation',
    'gestion_colocation_mouvement',
    'gestion_decompte',
  ];

  async function remplir(b: BancD1): Promise<string> {
    const { bien, location } = await creer(b, creation({ ...TERMINEE, debut: '2025-10-01' }));
    const id = location?.id ?? '';
    await avecBailleur(b);
    await b.requete('/api/gestion/depenses', {
      corps: {
        bienId: bien.id,
        categorie: 'copropriete',
        montant: 4_500,
        date: '2025-01-10',
        recuperable: true,
        recurrence: { frequence: 'mensuelle' },
      },
    });
    await b.requete(`/api/gestion/fin-bail/locations/${id}/conge`, {
      method: 'PUT',
      corps: { recuLe: '2027-02-28', fin: '2027-03-31', reduit: false },
    });
    await b.requete(`/api/gestion/fin-bail/locations/${id}/charges`, {
      method: 'PUT',
      corps: { mode: 'provision' },
    });
    await restituer(b, id, { clesLe: '2027-03-31', conforme: true, retenues: [] });
    await b.requete(`/api/gestion/fin-bail/locations/${id}/colocataires`, {
      corps: { arrivee: { locataire: { prenom: 'Léa', nom: 'Bernard' }, date: '2027-01-01' } },
    });
    await b.requete(`/api/gestion/fin-bail/locations/${id}/regularisations`, {
      corps: { annee: 2026 },
    });
    expect(TABLES.map((t) => compter(b.sqlite, t))).toEqual([1, 1, 1, 1, 1, 2]);
    return bien.id;
  }

  it('supprimer le bien ou le compte emporte congé, charges, dépôt, régularisation, mouvements et décomptes', async () => {
    const b = await connecte();
    const bienId = await remplir(b);
    expect((await b.requete(`/api/gestion/biens/${bienId}`, { method: 'DELETE' })).status).toBe(
      204,
    );
    expect(TABLES.map((t) => compter(b.sqlite, t))).toEqual([0, 0, 0, 0, 0, 0]);

    await remplir(b);
    const compte = b.sqlite.prepare('select id from "user" where email = ?').get(CAMILLE);
    b.sqlite.prepare('delete from "user" where id = ?').run(String(compte?.id));
    expect(TABLES.map((t) => compter(b.sqlite, t))).toEqual([0, 0, 0, 0, 0, 0]);
  });
});
