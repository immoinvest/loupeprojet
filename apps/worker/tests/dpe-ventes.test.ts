import { describe, expect, it } from 'vitest';

import {
  avecDpe,
  candidatsDepuisAdeme,
  cleBanVente,
  lireDpeVentes,
  MAX_DPE_PAR_PAQUET,
  moisAvant,
  rapprocherDpe,
  type DpeCandidat,
} from '../src/adresse/dpe-ventes';
import type { Dependances } from '../src/dependances';
import { cleCache } from '../src/proxy/cache';
import { banc, reponseJson } from './aide';

const CLE = '13205_6659_00144';

/** Un DPE de la base ADEME tel que l'API le rend (champs sélectionnés). */
function ligneAdeme(o: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    identifiant_ban: CLE,
    date_etablissement_dpe: '2024-12-10',
    etiquette_dpe: 'D',
    etiquette_ges: 'E',
    surface_habitable_logement: 62,
    conso_5_usages_par_m2_ep: 231.6,
    periode_construction: '1948-1974',
    type_energie_principale_chauffage: 'Gaz naturel',
    ...o,
  };
}

function candidat(o: Partial<DpeCandidat> = {}): DpeCandidat {
  return {
    cleBan: CLE,
    etiquetteDpe: 'D',
    etiquetteGes: 'E',
    consommationM2: 232,
    periodeConstruction: '1948-1974',
    energieChauffage: 'Gaz naturel',
    date: '2024-12-10',
    surface: 62,
    ...o,
  };
}

const VENTE = { date: '2025-03-01', surface: 60 };

describe('clé BAN d’une vente', () => {
  it('commune du bien ou de la vente voisine, voie en minuscules, numéro sur cinq chiffres', () => {
    expect(cleBanVente({ codeVoie: '6659', numero: 144, codeInsee: undefined }, '13205')).toBe(CLE);
    expect(cleBanVente({ codeVoie: 'B180', numero: 12, codeInsee: '13206' }, '13205')).toBe(
      '13206_b180_00012',
    );
    expect(cleBanVente({ codeVoie: null, numero: 12 }, '13205')).toBeNull();
    expect(cleBanVente({ codeVoie: '6659', numero: null }, '13205')).toBeNull();
    // 9001 Cité Valcros (Aix-en-Provence) : numéro fiscal, absent de la BAN.
    expect(cleBanVente({ codeVoie: 'A285', numero: 9001 }, '13001')).toBeNull();
    expect(cleBanVente({ codeVoie: '1161', numero: 8999 }, '13001')).toBe('13001_1161_08999');
  });

  it('recule d’un nombre de mois', () => {
    expect(moisAvant('2025-03-01', 18)).toBe('2023-09-01');
    expect(moisAvant('2025-01-15', 1)).toBe('2024-12-15');
  });
});

describe('DPE lisibles de la base ADEME', () => {
  it('garde étiquette, adresse, date et surface ; nettoie le reste', () => {
    const candidats = candidatsDepuisAdeme({
      results: [
        ligneAdeme({
          identifiant_ban: ' 13205_6659_00144 ',
          date_etablissement_dpe: '2024-12-10T00:00:00',
        }),
        ligneAdeme({
          etiquette_ges: null,
          conso_5_usages_par_m2_ep: null,
          periode_construction: '  ',
          type_energie_principale_chauffage: undefined,
        }),
        ligneAdeme({ etiquette_dpe: 'H' }),
        ligneAdeme({ identifiant_ban: null }),
        ligneAdeme({ date_etablissement_dpe: '10/12/2024' }),
        ligneAdeme({ date_etablissement_dpe: null }),
        ligneAdeme({ surface_habitable_logement: null }),
        ligneAdeme({ surface_habitable_logement: 0 }),
      ],
    });
    expect(candidats).toEqual([
      candidat(),
      candidat({
        etiquetteGes: null,
        consommationM2: null,
        periodeConstruction: null,
        energieChauffage: null,
      }),
    ]);
  });
});

describe('rapprochement d’une vente et d’un DPE', () => {
  it('surface à ±10 %, établi dans les 18 mois avant la vente', () => {
    expect(rapprocherDpe(VENTE, [candidat()])).toEqual({
      etiquetteDpe: 'D',
      etiquetteGes: 'E',
      consommationM2: 232,
      periodeConstruction: '1948-1974',
      energieChauffage: 'Gaz naturel',
      date: '2024-12-10',
      surface: 62,
    });
    // Bornes incluses : 18 mois pile, le jour de la vente, 54 et 66 m².
    expect(rapprocherDpe(VENTE, [candidat({ date: '2023-09-01', surface: 54 })])).not.toBeNull();
    expect(rapprocherDpe(VENTE, [candidat({ date: '2025-03-01', surface: 66 })])).not.toBeNull();
    // Hors fenêtre ou hors surface : rien.
    expect(rapprocherDpe(VENTE, [candidat({ date: '2023-08-31' })])).toBeNull();
    expect(rapprocherDpe(VENTE, [candidat({ date: '2025-03-02' })])).toBeNull();
    expect(rapprocherDpe(VENTE, [candidat({ surface: 45 })])).toBeNull();
    expect(rapprocherDpe(VENTE, [])).toBeNull();
  });

  it('plusieurs candidats : le plus proche en surface, puis en date', () => {
    const loin = candidat({ surface: 64, etiquetteDpe: 'F' });
    const proche = candidat({ surface: 61, etiquetteDpe: 'C', date: '2024-01-10' });
    const procheRecent = candidat({ surface: 59, etiquetteDpe: 'B', date: '2025-02-01' });
    expect(rapprocherDpe(VENTE, [loin, proche])?.etiquetteDpe).toBe('C');
    expect(rapprocherDpe(VENTE, [loin, proche, procheRecent])?.etiquetteDpe).toBe('B');
  });

  it('chaque vente reçoit le DPE de son adresse, ou null', () => {
    const dpe = { parCle: new Map([[CLE, [candidat()]]]), complet: true };
    expect(
      avecDpe(
        [
          { ...VENTE, cleBan: CLE },
          { ...VENTE, cleBan: '13205_6659_00146' },
          { ...VENTE, cleBan: null },
        ],
        dpe,
      ).map((v) => v.dpe?.etiquetteDpe ?? null),
    ).toEqual(['D', null, null]);
  });
});

type Fetcher = Dependances['fetcher'];

/** Fausse base ADEME : un DPE par adresse demandée ; note les URL. */
function fausseBase(appels: URL[]): Fetcher {
  return (url) => {
    appels.push(url);
    const cles = (url.searchParams.get('identifiant_ban_in') ?? '').split(',');
    return Promise.resolve(
      reponseJson({ results: cles.map((cle) => ligneAdeme({ identifiant_ban: cle })) }),
    );
  };
}

const cles = (nombre: number): string[] =>
  Array.from({ length: nombre }, (_, i) => `13205_6659_${String(i + 1).padStart(5, '0')}`);

describe('lecture des DPE des ventes', () => {
  it('une requête par paquet de 50 adresses distinctes, champs choisis, puis le cache', async () => {
    const appels: URL[] = [];
    const { deps } = banc({ fetcher: fausseBase(appels) });
    const r = await lireDpeVentes(deps, [...cles(120), ...cles(10)]);
    expect(appels).toHaveLength(3);
    expect(appels[0]?.origin).toBe('https://data.ademe.fr');
    expect(appels[0]?.searchParams.get('size')).toBe(String(MAX_DPE_PAR_PAQUET));
    expect(appels[0]?.searchParams.get('select')).toContain('conso_5_usages_par_m2_ep');
    // Les paquets partent en parallèle (empreinte et cache asynchrones) : l'ordre des appels n'est pas garanti.
    const paquets = appels.map((a) => a.searchParams.get('identifiant_ban_in')?.split(',') ?? []);
    expect(paquets.map((p) => p.length).sort((a, b) => a - b)).toEqual([20, 50, 50]);
    expect(new Set(paquets.flat()).size).toBe(120);
    expect(r.complet).toBe(true);
    expect(r.parCle.size).toBe(120);
    expect(r.parCle.get('13205_6659_00001')).toHaveLength(1);

    await lireDpeVentes(deps, cles(120));
    expect(appels).toHaveLength(3);
  });

  it('quatre paquets au plus : 200 adresses, les premières de la liste', async () => {
    const appels: URL[] = [];
    const { deps } = banc({ fetcher: fausseBase(appels) });
    const r = await lireDpeVentes(deps, cles(260));
    expect(appels).toHaveLength(4);
    expect(r.parCle.has('13205_6659_00200')).toBe(true);
    expect(r.parCle.has('13205_6659_00201')).toBe(false);
  });

  it('regroupe plusieurs DPE à la même adresse ; aucune adresse, aucune requête', async () => {
    const appels: URL[] = [];
    const { deps } = banc({
      fetcher: (url) => {
        appels.push(url);
        return Promise.resolve(
          reponseJson({ results: [ligneAdeme(), ligneAdeme({ etiquette_dpe: 'F' })] }),
        );
      },
    });
    expect((await lireDpeVentes(deps, [CLE])).parCle.get(CLE)).toHaveLength(2);
    expect(await lireDpeVentes(deps, [])).toEqual({ parCle: new Map(), complet: true });
    expect(appels).toHaveLength(1);
  });

  it('un cache illisible est redemandé', async () => {
    const appels: URL[] = [];
    const { deps } = banc({ fetcher: fausseBase(appels) });
    const cle = await cleCache('dpe-ventes', { version: 1, cles: [CLE] });
    await deps.cache.ecrire(cle, '[{"autre":1}]', 60);
    expect((await lireDpeVentes(deps, [CLE])).parCle.get(CLE)).toHaveLength(1);
    expect(appels).toHaveLength(1);
  });

  it('base en panne : ventes sans DPE, lecture incomplète, rien en cache, journalisé', async () => {
    const cas: [Fetcher, string][] = [
      [() => Promise.reject(new Error('délai')), 'dpe_ventes.injoignable'],
      [() => Promise.resolve(reponseJson({}, 503)), 'dpe_ventes.erreur'],
      [() => Promise.resolve(new Response('<html>')), 'dpe_ventes.injoignable'],
      [() => Promise.resolve(reponseJson({ results: 'non' })), 'dpe_ventes.invalide'],
    ];
    for (const [fetcher, evenement] of cas) {
      const { deps, journal } = banc({ fetcher });
      const r = await lireDpeVentes(deps, [CLE]);
      expect(r).toEqual({ parCle: new Map(), complet: false });
      expect(journal.evenements.map((e) => e.evenement)).toEqual([evenement]);
      const cle = await cleCache('dpe-ventes', { version: 1, cles: [CLE] });
      expect(await deps.cache.lire(cle)).toBeNull();
    }
  });
});
