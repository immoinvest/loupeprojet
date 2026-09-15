import { describe, expect, it } from 'vitest';

import {
  filtrerAdresses,
  lireRecherche,
  lireVentes,
  normaliserTexte,
  regrouperAdresses,
  TTL_ADRESSES_DVF_SECONDES,
  type AdresseDvf,
} from '../src/adresse';
import { lecteurMemoire, type LecteurDonnees } from '../src/donnees/lecteur';
import { cleCache, type Cache } from '../src/proxy/cache';
import { banc } from './aide';

/*
 * Adresses fiscales d'Aix-en-Provence (commune 13001) relevées le 14/09/2026 dans les fichiers publics
 * geo-dvf 2023-2024 : voies, codes de voie, numéros, parcelles et point de Valcros tels que publiés ;
 * dates, prix et surfaces arrondis (lignes anonymes).
 */
const ENTETE =
  'date,prix,surface,type,pieces,lat,lon,idParcelle,numero,suffixe,codeVoie,voie,carrez';
const LIGNES = [
  '2024-03-12,168000,62,appartement,3,43.526878,5.430097,13001000CP0007,9001,,A285,CITE VALCROS,61',
  '2023-10-05,152000,55,appartement,3,43.526878,5.430097,13001000CP0007,9001,,A285,CITE VALCROS,',
  '2023-06-20,121000,41,appartement,2,,,13001000CP0007,9001,,A285,CITE VALCROS,',
  '2024-01-18,210000,68,appartement,3,43.5301,5.4212,13001000CP0090,9001,,A436,RES DE GALICE RUE DR BIANC,',
  '2023-09-02,185000,58,appartement,2,43.5321,5.4188,13001000CR0192,9001,,A366,RES GALICE RUE DE LA CHART,',
  '2024-05-30,245000,70,appartement,3,43.5307,5.4270,13001000CS0012,42,B,1161,RTE DE GALICE,',
  // Aucune vente située : l'adresse ne peut pas être analysée, elle n'est pas proposée.
  '2024-02-02,99000,30,appartement,1,,,13001000AB0001,9002,,A999,RES LES PINS,',
  // Sans voie : ignorée.
  '2024-02-03,99000,30,appartement,1,43.5,5.4,13001000AB0002,,,,,',
];
const CSV = [ENTETE, ...LIGNES].join('\n') + '\n';

interface Reponse {
  codeInsee: string;
  millesime: string | null;
  adresses: AdresseDvf[];
  sources: { nom: string }[];
}

describe('normalisation et recherche', () => {
  it('majuscules sans accents, ponctuation en espaces, abréviations développées', () => {
    expect(normaliserTexte("Rés. de l'Étang, bd St-Jean")).toEqual([
      'RESIDENCE',
      'DE',
      'L',
      'ETANG',
      'BOULEVARD',
      'SAINT',
      'JEAN',
    ]);
  });

  it('garde le numéro et les noms ; code postal, mots vides et types de voie sont écartés', () => {
    expect(lireRecherche('9001 route de Galice 13090 Aix-en-Provence')).toEqual({
      numero: 9001,
      mots: ['GALICE', 'AIX', 'PROVENCE'],
    });
    expect(lireRecherche('Cité Valcros cité')).toEqual({ numero: null, mots: ['VALCROS'] });
  });
});

describe('regroupement des adresses', () => {
  const adresses = regrouperAdresses(lireVentes(CSV));

  it('une adresse par numéro et voie : deux « 9001 » de Galice, point moyen des ventes situées', () => {
    expect(adresses.map((a) => a.libelle).sort()).toEqual([
      '42 B RTE DE GALICE',
      '9001 CITE VALCROS',
      '9001 RES DE GALICE RUE DR BIANC',
      '9001 RES GALICE RUE DE LA CHART',
    ]);
    expect(adresses.find((a) => a.codeVoie === 'A285')).toEqual({
      libelle: '9001 CITE VALCROS',
      numero: 9001,
      suffixe: null,
      codeVoie: 'A285',
      voie: 'CITE VALCROS',
      parcelles: ['13001000CP0007'],
      lat: 43.526878,
      lon: 5.430097,
      ventes: 3,
    });
  });

  it('filtre par numéro et par mot, les plus proches du texte d’abord', () => {
    const galice = filtrerAdresses(adresses, lireRecherche('9001 route de Galice 13090 Aix'), 6);
    expect(galice.map((a) => a.codeVoie)).toEqual(['A436', 'A366']);
    const valcros = filtrerAdresses(
      adresses,
      lireRecherche('9001 Cité Valcros Aix-en-Provence'),
      6,
    );
    expect(valcros.map((a) => a.codeVoie)).toEqual(['A285']);
    // Début de mot : trois lettres suffisent ; deux lettres doivent être un mot entier.
    expect(filtrerAdresses(adresses, lireRecherche('valc'), 6)).toHaveLength(1);
    expect(filtrerAdresses(adresses, lireRecherche('va'), 6)).toHaveLength(0);
    // Plus de mots trouvés d'abord : « galice bianc » met la résidence du docteur Bianc en tête.
    expect(filtrerAdresses(adresses, lireRecherche('galice docteur bianc'), 6)[0]?.codeVoie).toBe(
      'A436',
    );
    expect(filtrerAdresses(adresses, lireRecherche('galice'), 2)).toHaveLength(2);
    expect(filtrerAdresses(adresses, lireRecherche('9001 rue'), 6)).toEqual([]);
    expect(filtrerAdresses(adresses, lireRecherche('8000 galice'), 6)).toEqual([]);
  });
});

describe('GET /marche/adresses-dvf', () => {
  /** Un cache mémoire qui compte ses écritures. */
  function cacheCompte(): Cache & { ecritures: string[]; valeurs: Map<string, string> } {
    const valeurs = new Map<string, string>();
    const ecritures: string[] = [];
    return {
      valeurs,
      ecritures,
      lire: (cle) => Promise.resolve(valeurs.get(cle) ?? null),
      ecrire: (cle, valeur) => {
        ecritures.push(cle);
        valeurs.set(cle, valeur);
        return Promise.resolve();
      },
    };
  }

  it('rend les deux résidences de Galice et lit la commune une seule fois (une écriture de cache)', async () => {
    const cache = cacheCompte();
    const donnees = lecteurMemoire({ 'dvf/2025/13001.csv': CSV });
    const { requete } = banc({ cache, donnees });
    const r = await requete(
      `/marche/adresses-dvf?codeInsee=13001&texte=${encodeURIComponent('9001 route de Galice 13090 Aix-en-Provence')}`,
    );
    expect(r.status).toBe(200);
    expect(r.headers.get('X-Loupe-Cache')).toBe('MISS');
    const corps = await r.json<Reponse>();
    expect(corps.millesime).toBe('2025');
    expect(corps.adresses.map((a) => a.libelle)).toEqual([
      '9001 RES DE GALICE RUE DR BIANC',
      '9001 RES GALICE RUE DE LA CHART',
    ]);
    expect(corps.sources).toHaveLength(1);

    const r2 = await requete(
      `/marche/adresses-dvf?codeInsee=13001&texte=${encodeURIComponent('9001 Cité Valcros')}&limit=1`,
    );
    expect(r2.headers.get('X-Loupe-Cache')).toBe('HIT');
    expect((await r2.json<Reponse>()).adresses.map((a) => a.codeVoie)).toEqual(['A285']);
    expect(donnees.lectures.filter((l) => l === 'dvf/2025/13001.csv')).toHaveLength(1);
    expect(cache.ecritures).toEqual([
      await cleCache('adresses-dvf', { version: 1, codeInsee: '13001' }),
    ]);
    expect(TTL_ADRESSES_DVF_SECONDES).toBe(86_400);
  });

  it('commune non publiée : aucune adresse, aucune source', async () => {
    const { requete } = banc({ donnees: lecteurMemoire({}) });
    const r = await requete('/marche/adresses-dvf?codeInsee=13001&texte=valcros');
    expect(await r.json<Reponse>()).toMatchObject({ millesime: null, adresses: [], sources: [] });
  });

  it('R2 en panne : répond sans rien écrire en cache', async () => {
    const cache = cacheCompte();
    const { requete } = banc({
      cache,
      donnees: {
        lireJson: () => Promise.reject(new Error('R2 indisponible')),
        lireTexte: () => Promise.reject(new Error('R2 indisponible')),
      } satisfies LecteurDonnees,
    });
    const r = await requete('/marche/adresses-dvf?codeInsee=13001&texte=valcros');
    expect(r.status).toBe(200);
    expect((await r.json<Reponse>()).adresses).toEqual([]);
    expect(cache.ecritures).toEqual([]);
  });

  it('une liste en cache illisible est relue depuis R2', async () => {
    const cache = cacheCompte();
    const cle = await cleCache('adresses-dvf', { version: 1, codeInsee: '13001' });
    const { requete } = banc({ cache, donnees: lecteurMemoire({ 'dvf/2025/13001.csv': CSV }) });
    for (const valeur of ['{pas du json', JSON.stringify({ millesime: 2025 })]) {
      cache.valeurs.set(cle, valeur);
      const r = await requete('/marche/adresses-dvf?codeInsee=13001&texte=valcros');
      expect(r.headers.get('X-Loupe-Cache')).toBe('MISS');
      expect((await r.json<Reponse>()).adresses).toHaveLength(1);
    }
  });

  it('refuse des paramètres invalides', async () => {
    const { requete } = banc();
    const r = await requete('/marche/adresses-dvf?codeInsee=1300&texte=ab&limit=50');
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({
      code: 'PARAMETRES_INVALIDES',
      details: { champs: ['codeInsee', 'texte', 'limit'] },
    });
  });
});
