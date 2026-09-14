import type { CreationLocation, CreationReponse } from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import { LIMITE_BIENS } from '../src/gestion/depot-d1';
import { bancD1, compter, connecter, type Banc } from './aide';

/** Le 14 septembre 2026 à midi : la date du jour des contrôles du dépôt. */
const MAINTENANT = (): string => '2026-09-14T12:00:00.000Z';

const BIEN: CreationLocation['bien'] = {
  nom: 'T2 Lices',
  adresse: '12 rue des Lices',
  type: 'appartement',
  meuble: true,
};

/** Entrée le 1er octobre 2026, sortie le 14 mars 2027. */
const AVEC_SORTIE: CreationLocation = {
  bien: BIEN,
  locataire: { prenom: 'Julie', nom: 'Martin' },
  location: {
    type: 'meublee',
    debut: '2026-10-01',
    fin: '2027-03-14',
    jourLoyer: 5,
    loyerHorsCharges: 65_000,
    charges: 5_000,
    depot: 130_000,
  },
};

/** Entrée le 1er janvier 2025, sortie inconnue. */
const SANS_SORTIE: CreationLocation = {
  bien: BIEN,
  locataire: { prenom: 'Antoine', nom: 'Dupont' },
  location: {
    type: 'nue',
    debut: '2025-01-01',
    jourLoyer: 3,
    loyerHorsCharges: 40_000,
    charges: 3_000,
    depot: 40_000,
  },
};

async function creer(b: Banc, creation: CreationLocation): Promise<string> {
  const reponse = await b.requete('/api/gestion/locations', { corps: creation });
  expect(reponse.status).toBe(201);
  const cree = (await reponse.json()) as CreationReponse;
  return cree.location?.id ?? '';
}

/** Un paiement de 1 € : ces tests portent sur les bornes de période, pas sur le montant dû. */
function payer(b: Banc, locationId: string, periode: string): Promise<Response> {
  return b.requete('/api/gestion/paiements', {
    corps: { locationId, periode, montant: 100, date: '2026-09-14' },
  });
}

describe('bornes de l’API de gestion (audit de sécurité)', () => {
  it('la limite par défaut vaut 200 biens par compte', () => {
    expect(LIMITE_BIENS).toBe(200);
  });

  it('au-delà de la limite de biens : 409 LIMITE_ATTEINTE, rien n’est écrit', async () => {
    const b = bancD1({ optionsDepot: { limiteBiens: 2, maintenant: MAINTENANT } });
    await connecter(b, 'camille@example.org');
    await creer(b, AVEC_SORTIE);
    await creer(b, AVEC_SORTIE);
    const r = await b.requete('/api/gestion/locations', { corps: AVEC_SORTIE });
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ code: 'LIMITE_ATTEINTE' });
    expect(compter(b.sqlite, 'gestion_bien')).toBe(2);
    expect(compter(b.sqlite, 'gestion_location')).toBe(2);
  });

  it('un loyer ne se reçoit ni avant l’entrée ni après la sortie', async () => {
    const b = bancD1({ optionsDepot: { maintenant: MAINTENANT } });
    await connecter(b, 'camille@example.org');
    const locationId = await creer(b, AVEC_SORTIE);

    for (const periode of ['2026-09', '2027-04']) {
      const r = await payer(b, locationId, periode);
      expect(r.status, periode).toBe(400);
      expect(await r.json()).toEqual({ code: 'HORS_LOCATION' });
    }
    // Le mois de l'entrée et celui de la sortie sont dus (au prorata).
    for (const periode of ['2026-10', '2027-03']) {
      expect((await payer(b, locationId, periode)).status, periode).toBe(201);
    }
    expect(compter(b.sqlite, 'gestion_paiement')).toBe(2);
  });

  it('sans sortie connue : jusqu’à un an à l’avance, pas au-delà', async () => {
    const b = bancD1({ optionsDepot: { maintenant: MAINTENANT } });
    await connecter(b, 'camille@example.org');
    const locationId = await creer(b, SANS_SORTIE);

    // Le 14 septembre 2026 + 366 jours = le 15 septembre 2027 : 2027-09 accepté, 2027-10 refusé.
    expect((await payer(b, locationId, '2027-09')).status).toBe(201);
    const tropTot = await payer(b, locationId, '2027-10');
    expect(tropTot.status).toBe(400);
    expect(await tropTot.json()).toEqual({ code: 'HORS_LOCATION' });
    expect((await payer(b, locationId, '2025-01')).status).toBe(201);
  });
});
