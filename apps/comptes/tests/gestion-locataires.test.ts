import type {
  CreationLocation,
  CreationReponse,
  DocumentComplet,
  EtatGestion,
  Locataire,
} from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import { bancD1, connecter } from './aide';

type Banc = ReturnType<typeof bancD1>;

const CAMILLE = 'camille@example.org';
/** Le 15 décembre 2026. */
const HORLOGE = { optionsDepot: { maintenant: () => '2026-12-15T09:00:00.000Z' } };

const LOUEE: CreationLocation = {
  bien: { nom: 'T2 Lices', adresse: '12 rue des Lices', type: 'appartement', meuble: true },
  locataire: { prenom: 'Julie', nom: 'Martin', email: 'julie@exemple.fr' },
  location: {
    type: 'meublee',
    debut: '2026-10-01',
    jourLoyer: 5,
    loyerHorsCharges: 65_000,
    charges: 5_000,
    depot: 130_000,
  },
};

async function lire<T>(reponse: Response): Promise<T> {
  return (await reponse.json()) as T;
}

async function connecte(): Promise<Banc> {
  const b = bancD1(HORLOGE);
  await connecter(b, CAMILLE);
  return b;
}

async function creer(b: Banc): Promise<CreationReponse> {
  const r = await b.requete('/api/gestion/locations', { corps: LOUEE });
  expect(r.status).toBe(201);
  return lire<CreationReponse>(r);
}

function modifier(b: Banc, locataireId: string, corps: object): Promise<Response> {
  return b.requete(`/api/gestion/locataires/${locataireId}`, { method: 'PATCH', corps });
}

async function locataires(b: Banc): Promise<Locataire[]> {
  return (await lire<EtatGestion>(await b.requete('/api/gestion/etat'))).locataires;
}

describe('modifier un locataire', () => {
  it('200 : nom et e-mail corrigés ; sans e-mail, il est retiré ; la quittance déjà émise garde l’ancien nom', async () => {
    const b = await connecte();
    const bailleur = { nom: 'Pierre Georgel', adresse: '3 rue Paradis, 13006 Marseille' };
    expect(
      (await b.requete('/api/gestion/bailleur', { method: 'PUT', corps: bailleur })).status,
    ).toBe(200);
    const creation = await creer(b);
    const locationId = creation.location?.id ?? '';
    const locataireId = creation.locataire?.id ?? '';
    const paiement = { locationId, periode: '2026-10', montant: 70_000, date: '2026-12-15' };
    expect((await b.requete('/api/gestion/paiements', { corps: paiement })).status).toBe(201);
    const quittance = await lire<DocumentComplet>(
      await b.requete('/api/gestion/documents', {
        corps: { type: 'quittance', locationId, periode: '2026-10' },
      }),
    );

    const r = await modifier(b, locataireId, {
      prenom: 'Julie',
      nom: 'Martin-Roux',
      email: 'julie.martin@exemple.fr',
    });
    expect(r.status).toBe(200);
    expect(await lire<Locataire>(r)).toMatchObject({
      id: locataireId,
      nom: 'Martin-Roux',
      email: 'julie.martin@exemple.fr',
    });
    const sansEmail = await lire<Locataire>(
      await modifier(b, locataireId, { prenom: 'Julie', nom: 'Martin-Roux' }),
    );
    expect(sansEmail).not.toHaveProperty('email');
    expect(await locataires(b)).toEqual([sansEmail]);

    const relu = await lire<DocumentComplet>(
      await b.requete(`/api/gestion/documents/${quittance.id}`),
    );
    expect(relu.contenu.locataires).toEqual([{ prenom: 'Julie', nom: 'Martin' }]);
  });

  it('refus : e-mail invalide 400, locataire inconnu ou d’un autre compte 404 ; rien ne change', async () => {
    const b = await connecte();
    const locataireId = (await creer(b)).locataire?.id ?? '';
    const invalide = await modifier(b, locataireId, {
      prenom: 'Julie',
      nom: 'Martin',
      email: 'pas-un-email',
    });
    expect(invalide.status).toBe(400);
    expect((await modifier(b, 'inconnu', { prenom: 'Julie', nom: 'Martin' })).status).toBe(404);

    const autre = bancD1({ ...HORLOGE, sqlite: b.sqlite });
    await connecter(autre, 'antoine.dupont@example.org');
    expect((await modifier(autre, locataireId, { prenom: 'Intrus', nom: 'Test' })).status).toBe(
      404,
    );
    expect((await locataires(b))[0]).toMatchObject({
      prenom: 'Julie',
      nom: 'Martin',
      email: 'julie@exemple.fr',
    });
  });
});
