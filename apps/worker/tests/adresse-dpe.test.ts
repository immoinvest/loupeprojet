import { describe, expect, it } from 'vitest';

import { SOURCE_ADEME, SOURCE_DVF } from '../src/adresse/route';
import type { Dependances } from '../src/dependances';
import { lecteurMemoire } from '../src/donnees/lecteur';
import { banc, reponseJson } from './aide';

/** 144 rue de l'Olivier, Marseille 5e : deux ventes au même numéro. */
const CSV = `${[
  'date,prix,surface,type,pieces,lat,lon,idParcelle,numero,suffixe,codeVoie,voie,carrez',
  '2025-03-01,240000,60,appartement,3,43.294813,5.393807,132058200E0318,144,,6659,RUE DE L OLIVIER,58.5',
  '2024-11-02,234000,65,appartement,3,43.294813,5.393807,132058200E0318,144,,6659,RUE DE L OLIVIER,',
].join('\n')}\n`;

/** Les deux DPE de la base ADEME au 144 rue de l'Olivier (relevés le 15/09/2026). */
const DPE_OLIVIER = [
  {
    identifiant_ban: '13205_6659_00144',
    date_etablissement_dpe: '2024-11-06',
    etiquette_dpe: 'C',
    etiquette_ges: 'C',
    surface_habitable_logement: 64.1,
    conso_5_usages_par_m2_ep: 172.4,
    periode_construction: 'avant 1948',
    type_energie_principale_chauffage: 'Gaz naturel',
  },
  {
    identifiant_ban: '13205_6659_00144',
    date_etablissement_dpe: '2024-07-08',
    etiquette_dpe: 'D',
    etiquette_ges: 'D',
    surface_habitable_logement: 72.5,
    conso_5_usages_par_m2_ep: 178,
    periode_construction: 'avant 1948',
    type_energie_principale_chauffage: 'Gaz naturel',
  },
];

type Fetcher = Dependances['fetcher'];

function amont(ademe: () => Promise<Response>, appelsAdeme: URL[] = []): Fetcher {
  return (url) => {
    if (url.hostname === 'geo.api.gouv.fr') return Promise.resolve(reponseJson([]));
    if (url.hostname === 'data.ademe.fr') {
      appelsAdeme.push(url);
      return ademe();
    }
    return Promise.resolve(reponseJson({ features: [] }));
  };
}

const REQUETE =
  '/marche/adresse?codeInsee=13205&lat=43.294813&lon=5.393807&numero=144&codeVoie=6659&type=appartement&surface=60';

interface Reponse {
  dpeVentes: string;
  ventesProchesTotal: number;
  ventesProchesTronquees: boolean;
  ventesProches: { date: string; cleBan: string | null; dpe: Record<string, unknown> | null }[];
  sources: { nom: string }[];
}

describe('GET /marche/adresse : DPE probable des ventes', () => {
  it('rapproche le DPE de la vente de 2025, aucun pour celle de 2024, ajoute la source ADEME', async () => {
    const appelsAdeme: URL[] = [];
    const { requete } = banc({
      fetcher: amont(() => Promise.resolve(reponseJson({ results: DPE_OLIVIER })), appelsAdeme),
      donnees: lecteurMemoire({ 'dvf/2025/13205.csv': CSV }),
    });
    const r = await requete(REQUETE);
    const corps = await r.json<Reponse>();
    expect(corps.dpeVentes).toBe('ok');
    expect(corps.ventesProchesTotal).toBe(2);
    expect(corps.ventesProchesTronquees).toBe(false);
    const parDate = Object.fromEntries(corps.ventesProches.map((v) => [v.date, v]));
    // 60 m² vendus le 01/03/2025 : le DPE de 64,1 m² du 06/11/2024.
    expect(parDate['2025-03-01']?.dpe).toEqual({
      etiquetteDpe: 'C',
      etiquetteGes: 'C',
      consommationM2: 172,
      periodeConstruction: 'avant 1948',
      energieChauffage: 'Gaz naturel',
      date: '2024-11-06',
      surface: 64.1,
    });
    // 65 m² vendus le 02/11/2024 : DPE de 64,1 m² établi après la vente, celui de 72,5 m² trop grand.
    expect(parDate['2024-11-02']?.dpe).toBeNull();
    expect(corps.sources.map((s) => s.nom)).toEqual([SOURCE_DVF.nom, SOURCE_ADEME.nom]);
    expect(appelsAdeme).toHaveLength(1);
    expect(appelsAdeme[0]?.searchParams.get('identifiant_ban_in')).toBe('13205_6659_00144');
    expect((await requete(REQUETE)).headers.get('x-loupe-cache')).toBe('HIT');
  });

  it('base ADEME en panne : ventes sans DPE, jamais mise en cache', async () => {
    const { requete } = banc({
      fetcher: amont(() => Promise.resolve(reponseJson({}, 503))),
      donnees: lecteurMemoire({ 'dvf/2025/13205.csv': CSV }),
    });
    const corps = await (await requete(REQUETE)).json<Reponse>();
    expect(corps.dpeVentes).toBe('indisponible');
    expect(corps.ventesProches.every((v) => v.dpe === null)).toBe(true);
    expect(corps.sources.map((s) => s.nom)).toEqual([SOURCE_DVF.nom]);
    expect((await requete(REQUETE)).headers.get('x-loupe-cache')).toBe('MISS');
  });

  it('ventes sans voie ni numéro (ancien CSV) : la base ADEME n’est pas interrogée', async () => {
    const appelsAdeme: URL[] = [];
    const { requete } = banc({
      fetcher: amont(() => Promise.resolve(reponseJson({ results: [] })), appelsAdeme),
      donnees: lecteurMemoire({
        'dvf/2025/13205.csv':
          'date,prix,surface,type,pieces,lat,lon\n2025-03-01,240000,60,appartement,3,43.294813,5.393807\n',
      }),
    });
    const corps = await (await requete(REQUETE)).json<Reponse>();
    expect(corps.dpeVentes).toBe('sans_adresse');
    expect(corps.ventesProches).toHaveLength(1);
    expect(corps.ventesProches[0]?.cleBan).toBeNull();
    expect(appelsAdeme).toHaveLength(0);
  });
});
