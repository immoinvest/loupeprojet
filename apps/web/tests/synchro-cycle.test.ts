import { projetExemple, ProjetSchema } from '@loupe/moteur';
import {
  changerDeCompte,
  JOURNAL_VIDE,
  type EtatLocal,
  type ProjetEnregistre,
  type ReponseSynchro,
} from '@loupe/projets';
import { describe, expect, it } from 'vitest';

import { synchroniserTout, TOURS_MAX } from '@/stockage/synchro/cycle';
import { clientProjetsMemoire } from '@/stockage/synchro/memoire';
import type { ClientProjets, CodeErreurSynchro } from '@/stockage/synchro/types';

function projet(id: string, creeLe = '2026-09-14T10:00:00.000Z'): ProjetEnregistre {
  return {
    id,
    nom: `Projet ${id}`,
    statut: 'analyse',
    creeLe,
    modifieLe: creeLe,
    projet: ProjetSchema.parse({ ...projetExemple, id }),
  };
}

function stockageFaux(etat: EtatLocal): {
  lire: () => EtatLocal;
  transformer: (t: (e: EtatLocal) => EtatLocal) => void;
} {
  let courant = etat;
  return {
    lire: () => courant,
    transformer: (t) => {
      courant = t(courant);
    },
  };
}

describe('synchroniserTout', () => {
  it('première connexion : lit le compte, puis envoie les projets de l’appareil par lots', async () => {
    const distant = projet('distant', '2026-09-01T00:00:00.000Z');
    const client = clientProjetsMemoire({ projets: [distant] });
    const locaux = Array.from({ length: 12 }, (_, i) => projet(`local-${String(i)}`));
    const stockage = stockageFaux(
      changerDeCompte({ projets: locaux, journal: JOURNAL_VIDE }, 'u1'),
    );

    expect(await synchroniserTout(client, stockage, 'u1')).toBe('a_jour');
    expect(client.demandes.map((d) => d.changements.length)).toEqual([0, 10, 2]);
    expect(client.distants()).toHaveLength(13);
    expect(stockage.lire().projets).toHaveLength(13);
    expect(stockage.lire().journal).toMatchObject({ aEnvoyer: [], curseur: 13, premiere: false });
  });

  it('projets refusés à la limite : statut « limite », pas de boucle', async () => {
    const client = clientProjetsMemoire({ limite: 1 });
    const stockage = stockageFaux(
      changerDeCompte({ projets: [projet('a'), projet('b')], journal: JOURNAL_VIDE }, 'u1'),
    );
    expect(await synchroniserTout(client, stockage, 'u1')).toBe('limite');
    expect(client.demandes).toHaveLength(2);
    expect(stockage.lire().journal.aEnvoyer).toEqual(['b']);
  });

  it('les erreurs donnent un statut', async () => {
    const cas: [CodeErreurSynchro, string][] = [
      ['non_connecte', 'reconnexion'],
      ['reseau', 'hors_ligne'],
      ['indisponible', 'indisponible'],
      ['invalide', 'indisponible'],
    ];
    for (const [code, statut] of cas) {
      const client = clientProjetsMemoire();
      client.echouer(code);
      const stockage = stockageFaux({ projets: [], journal: { ...JOURNAL_VIDE, compte: 'u1' } });
      expect(await synchroniserTout(client, stockage, 'u1')).toBe(statut);
    }
  });

  it('un autre compte lié à l’appareil : rien n’est envoyé ni appliqué', async () => {
    const client = clientProjetsMemoire();
    const stockage = stockageFaux({ projets: [], journal: { ...JOURNAL_VIDE, compte: 'lea' } });
    expect(await synchroniserTout(client, stockage, 'camille')).toBe('local');
    expect(client.demandes).toEqual([]);

    // L'appareil change de compte pendant l'échange : la réponse de l'ancien est ignorée.
    const courant = stockageFaux({ projets: [], journal: { ...JOURNAL_VIDE, compte: 'camille' } });
    const bascule: ClientProjets = {
      synchroniser: () => {
        courant.transformer(() => ({ projets: [], journal: { ...JOURNAL_VIDE, compte: 'lea' } }));
        return Promise.resolve({
          ok: true,
          valeur: { curseur: 5, suite: false, ids: ['x'], refuses: [], projets: [projet('x')] },
        });
      },
    };
    expect(await synchroniserTout(bascule, courant, 'camille')).toBe('a_jour');
    expect(courant.lire()).toEqual({ projets: [], journal: { ...JOURNAL_VIDE, compte: 'lea' } });
  });

  it(`s’arrête après ${String(TOURS_MAX)} échanges si le serveur annonce toujours une suite`, async () => {
    const sansFin: ReponseSynchro = { curseur: 1, suite: true, ids: [], refuses: [], projets: [] };
    let appels = 0;
    const client: ClientProjets = {
      synchroniser: () => {
        appels += 1;
        return Promise.resolve({ ok: true, valeur: sansFin });
      },
    };
    const stockage = stockageFaux({ projets: [], journal: { ...JOURNAL_VIDE, compte: 'u1' } });
    expect(await synchroniserTout(client, stockage, 'u1')).toBe('indisponible');
    expect(appels).toBe(TOURS_MAX);
  });
});
