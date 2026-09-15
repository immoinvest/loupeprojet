import { ajouterMois, CHANGEMENTS_MAX, type CreationReponse } from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import { bancD1, compter, connecter } from './aide';

/** Le 15 décembre 2026. */
const HORLOGE = { optionsDepot: { maintenant: () => '2026-12-15T09:00:00.000Z' } };

describe('borne des changements de montants', () => {
  it('au-delà de 120 changements : 409 LIMITE_ATTEINTE ; le changement d’un mois déjà changé reste remplaçable ; l’état se relit', async () => {
    const b = bancD1(HORLOGE);
    await connecter(b, 'camille@example.org');
    const r = await b.requete('/api/gestion/locations', {
      corps: {
        bien: { nom: 'T2 Lices', adresse: '12 rue des Lices', type: 'appartement', meuble: true },
        locataire: { prenom: 'Julie', nom: 'Martin' },
        location: {
          type: 'meublee',
          debut: '2010-01-01',
          jourLoyer: 5,
          loyerHorsCharges: 65_000,
          charges: 5_000,
          depot: 130_000,
        },
      },
    });
    const creation = (await r.json()) as CreationReponse;
    const id = creation.location?.id ?? '';
    const compte = b.sqlite
      .prepare('select userId from gestion_bien where id = ?')
      .get(creation.bien.id);
    const inserer = b.sqlite.prepare(
      'insert into gestion_changement (locationId, userId, aPartirDe, loyerHorsCharges, charges, apl, modifieLe) values (?, ?, ?, ?, ?, ?, ?)',
    );
    for (let i = 0; i < CHANGEMENTS_MAX; i += 1) {
      inserer.run(id, String(compte?.userId), ajouterMois('2010-01', i), 65_000, 5_000, 0, 'x');
    }
    const modifier = (aPartirDe: string): Promise<Response> =>
      b.requete(`/api/gestion/locations/${id}`, {
        method: 'PATCH',
        corps: { montants: { aPartirDe, loyerHorsCharges: 68_000, charges: 5_000, apl: 0 } },
      });

    const deTrop = await modifier('2026-10');
    expect(deTrop.status).toBe(409);
    expect(await deTrop.json()).toEqual({ code: 'LIMITE_ATTEINTE' });
    expect((await modifier('2015-06')).status).toBe(200);
    expect(compter(b.sqlite, 'gestion_changement')).toBe(CHANGEMENTS_MAX);
    expect((await b.requete('/api/gestion/etat')).status).toBe(200);
  });
});
