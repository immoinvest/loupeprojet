import { describe, expect, it } from 'vitest';

import {
  adresseDeRue,
  adresseDepuisCadastre,
  adresseDepuisSuggestion,
  casseDeTitre,
  clientHorsLigne,
  clientWorker,
  cleOptionAdresse,
  CONTRAT_ADRESSES_DVF,
  dansLeDepartement,
  demandeNumero,
  doitSuggerer,
  estNumeroFiscal,
  fautChercherAuCadastre,
  libelleCadastre,
  lieuDuCadastre,
  lireNumero,
  MAX_OPTIONS_ADRESSE,
  numeroTape,
  optionsAdresse,
  type AdresseDvf,
  type LieuCadastre,
  type SuggestionAdresse,
} from '@/enrichissement';
import {
  detailCadastre,
  detailSuggestion,
  phraseContexte,
  PHRASES_ADRESSE,
  questionNumero,
} from '@/textes/adresse';

const OLIVIER: SuggestionAdresse = {
  libelle: "144 Rue de l'Olivier 13005 Marseille",
  precision: 'adresse',
  numero: '144',
  rue: "Rue de l'Olivier",
  codePostal: '13005',
  commune: 'Marseille',
  codeInsee: '13205',
  lat: 43.294813,
  lon: 5.393807,
  cleBan: '13205_6659_00144',
};
const RUE_OLIVIER: SuggestionAdresse = {
  ...OLIVIER,
  libelle: "Rue de l'Olivier 13005 Marseille",
  precision: 'rue',
  numero: null,
  cleBan: '13205_6659',
};
const AVIGNON: SuggestionAdresse = {
  ...OLIVIER,
  libelle: "144 Rue de l'Olivier 84000 Avignon",
  codePostal: '84000',
  commune: 'Avignon',
  codeInsee: '84007',
  cleBan: '84007_0420_00144',
};
const GALICE: SuggestionAdresse = {
  libelle: 'Route de Galice 13090 Aix-en-Provence',
  precision: 'rue',
  numero: null,
  rue: 'Route de Galice',
  codePostal: '13090',
  commune: 'Aix-en-Provence',
  codeInsee: '13001',
  lat: 43.5307,
  lon: 5.427,
  cleBan: '13001_1161',
};
const VALCROS: AdresseDvf = {
  libelle: '9001 CITE VALCROS',
  numero: 9001,
  suffixe: null,
  codeVoie: 'A285',
  voie: 'CITE VALCROS',
  parcelles: ['13001000CP0007'],
  lat: 43.526878,
  lon: 5.430097,
  ventes: 3,
};
const AIX: LieuCadastre = { codeInsee: '13001', codePostal: '13090', commune: 'Aix-en-Provence' };

describe('lecture du texte tapé', () => {
  it('trois caractères pour suggérer ; numéro de voie sans le code postal ; numéros fiscaux', () => {
    expect(doitSuggerer(' ab ')).toBe(false);
    expect(doitSuggerer('abc')).toBe(true);
    expect(numeroTape('9001 route de Galice 13090 Aix')).toBe(9001);
    expect(numeroTape('13090 Aix, 42 rue')).toBe(42);
    expect(numeroTape('Cité Valcros')).toBeNull();
    expect(estNumeroFiscal(9001)).toBe(true);
    expect(estNumeroFiscal(8999)).toBe(false);
    expect(estNumeroFiscal(null)).toBe(false);
    expect(lireNumero(' 144 bis ')).toBe(144);
    expect(lireNumero('144B')).toBe(144);
    expect(lireNumero('cent')).toBeNull();
  });

  it('cadastre : numéro fiscal, résidence ou cité, numéro inconnu de la BAN', () => {
    expect(fautChercherAuCadastre('9001 route de Galice', [OLIVIER])).toBe(true);
    expect(fautChercherAuCadastre('Cité Valcros Aix', [])).toBe(true);
    expect(fautChercherAuCadastre('rés. les Pins', [])).toBe(true);
    expect(fautChercherAuCadastre('12 route de Galice', [GALICE])).toBe(true);
    expect(fautChercherAuCadastre("144 rue de l'oli", [OLIVIER])).toBe(false);
    expect(fautChercherAuCadastre("rue de l'olivier", [RUE_OLIVIER])).toBe(false);
    // « Lotissement » ne se lit pas dans « pilotis ».
    expect(fautChercherAuCadastre('rue des pilotis', [])).toBe(false);
  });
});

describe('liste des suggestions', () => {
  it('commune du cadastre : première suggestion située, sinon adresse enregistrée, sinon rien', () => {
    expect(lieuDuCadastre([{ ...GALICE, codeInsee: null }, GALICE], { departement: '13' })).toEqual(
      AIX,
    );
    const adresse = {
      libelle: '1 Cours Mirabeau',
      lat: 43.5,
      lon: 5.4,
      codeInsee: '13001',
      codeVoie: '0420',
      numero: 1,
    };
    expect(lieuDuCadastre([], { departement: '13', adresse })).toEqual({
      codeInsee: '13001',
      codePostal: null,
      commune: null,
    });
    expect(
      lieuDuCadastre([], { departement: '13', adresse: { ...adresse, codePostal: '13100' } }),
    ).toEqual({ codeInsee: '13001', codePostal: '13100', commune: null });
    expect(lieuDuCadastre([], { departement: '13' })).toBeNull();
  });

  it('département du projet d’abord, numéro avant rue avant lieu-dit, cadastre ensuite, précision inconnue écartée', () => {
    const lieuDit = { ...OLIVIER, libelle: 'Les Olivades', precision: 'lieu_dit', cleBan: null };
    const inconnue = { ...OLIVIER, libelle: 'X', precision: 'inconnue' };
    const options = optionsAdresse(
      [AVIGNON, lieuDit, RUE_OLIVIER, inconnue, OLIVIER],
      [VALCROS],
      AIX,
      '13',
    );
    expect(
      options.map((o) => (o.source === 'ban' ? o.suggestion.libelle : o.adresse.libelle)),
    ).toEqual([
      "144 Rue de l'Olivier 13005 Marseille",
      "Rue de l'Olivier 13005 Marseille",
      'Les Olivades',
      "144 Rue de l'Olivier 84000 Avignon",
      '9001 CITE VALCROS',
    ]);
    expect(options.map(cleOptionAdresse)).toEqual([
      'ban-13205_6659_00144',
      'ban-13205_6659',
      'ban-Les Olivades',
      'ban-84007_0420_00144',
      'cadastre-A285-9001-',
    ]);
    expect(options.map(demandeNumero)).toEqual([false, true, true, false, false]);
    expect(optionsAdresse([], [VALCROS], null, '13')).toEqual([]);
    const beaucoup = Array.from({ length: 12 }, (_, i) => ({ ...OLIVIER, cleBan: String(i) }));
    expect(optionsAdresse(beaucoup, [], null, '')).toHaveLength(MAX_OPTIONS_ADRESSE);
    expect(
      cleOptionAdresse({ source: 'cadastre', adresse: { ...VALCROS, suffixe: 'B' }, lieu: AIX }),
    ).toBe('cadastre-A285-9001-B');
  });

  it('département d’un code postal : Corse et outre-mer compris', () => {
    expect(dansLeDepartement('13005', '13')).toBe(true);
    expect(dansLeDepartement('20000', '2A')).toBe(true);
    expect(dansLeDepartement('97400', '974')).toBe(true);
    expect(dansLeDepartement('84000', '13')).toBe(false);
    expect(dansLeDepartement(null, '13')).toBe(false);
  });
});

describe('adresse analysée', () => {
  it('depuis une suggestion avec numéro : clé BAN lue, code postal gardé s’il est valable', () => {
    expect(adresseDepuisSuggestion(OLIVIER)).toEqual({
      libelle: "144 Rue de l'Olivier 13005 Marseille",
      lat: 43.294813,
      lon: 5.393807,
      codeInsee: '13205',
      codeVoie: '6659',
      numero: 144,
      codePostal: '13005',
    });
    expect(adresseDepuisSuggestion({ ...OLIVIER, cleBan: null, codePostal: null })).toEqual({
      libelle: OLIVIER.libelle,
      lat: OLIVIER.lat,
      lon: OLIVIER.lon,
      codeInsee: '13205',
      codeVoie: null,
      numero: null,
    });
    expect(adresseDepuisSuggestion({ ...OLIVIER, codeInsee: null })).toBeNull();
  });

  it('depuis une rue : avec le numéro donné, ou sans', () => {
    expect(adresseDeRue(RUE_OLIVIER, 144)).toMatchObject({
      libelle: "144 Rue de l'Olivier 13005 Marseille",
      codeVoie: '6659',
      numero: 144,
    });
    expect(adresseDeRue(RUE_OLIVIER, null)).toMatchObject({
      libelle: RUE_OLIVIER.libelle,
      numero: null,
    });
    expect(adresseDeRue({ ...RUE_OLIVIER, codeInsee: null }, 1)).toBeNull();
  });

  it('depuis le cadastre : numéro fiscal et code de voie A…, libellé en casse de titre', () => {
    expect(adresseDepuisCadastre(VALCROS, AIX)).toEqual({
      libelle: '9001 Cite Valcros, 13090 Aix-en-Provence',
      lat: 43.526878,
      lon: 5.430097,
      codeInsee: '13001',
      codeVoie: 'A285',
      numero: 9001,
      codePostal: '13090',
    });
    expect(casseDeTitre('9001  RES DE GALICE RUE DR BIANC')).toBe(
      '9001 Res de Galice Rue Dr Bianc',
    );
    expect(casseDeTitre('LE CLOS')).toBe('Le Clos');
    expect(libelleCadastre(VALCROS, { codeInsee: '13001', codePostal: null, commune: null })).toBe(
      '9001 Cite Valcros',
    );
    expect(adresseDepuisCadastre(VALCROS, { ...AIX, codePostal: 'abc' })).not.toHaveProperty(
      'codePostal',
    );
  });
});

describe('phrases', () => {
  it('contexte, précision, cadastre et question du numéro', () => {
    expect(phraseContexte('13')).toBe("Suggestions d'abord dans le département 13.");
    expect(phraseContexte(' ')).toBeNull();
    expect(detailSuggestion('rue')).toBe('rue, sans numéro');
    expect(detailSuggestion('lieu_dit')).toBe('lieu-dit');
    expect(detailSuggestion('adresse')).toBeUndefined();
    expect(detailCadastre(3)).toBe('adresse du cadastre, 3 ventes connues');
    expect(detailCadastre(1)).toBe('adresse du cadastre, 1 vente connue');
    expect(questionNumero('Route de Galice')).toBe('Numéro dans Route de Galice ?');
    expect(PHRASES_ADRESSE.numeroCadastre).toContain('cadastre');
  });
});

describe('client : suggestions et adresses du cadastre', () => {
  const repondre =
    (corps: unknown, statut = 200, urls: string[] = []) =>
    (url: string): Promise<Response> => {
      urls.push(url);
      return Promise.resolve(new Response(JSON.stringify(corps), { status: statut }));
    };

  it('suggestions : biais de position facultatif, réponse revalidée', async () => {
    const urls: string[] = [];
    const client = clientWorker(
      'https://w',
      repondre({ donnees: { suggestions: [OLIVIER] } }, 200, urls),
    );
    expect(await client.suggererAdresses('144 rue', { lat: 43.29, lon: 5.39 })).toEqual({
      ok: true,
      valeur: [OLIVIER],
    });
    await client.suggererAdresses('144 rue', null);
    expect(urls).toEqual([
      'https://w/proxy/adresses?q=144+rue&limit=6&lat=43.29&lon=5.39',
      'https://w/proxy/adresses?q=144+rue&limit=6',
    ]);
    const ancien = clientWorker('https://w', repondre({ code: 'SERVICE_INCONNU' }, 404));
    expect(await ancien.suggererAdresses('144 rue', null)).toEqual({
      ok: false,
      code: 'SERVICE_INCONNU',
    });
  });

  it('adresses du cadastre : version du contrat dans l’URL, réponse revalidée', async () => {
    const urls: string[] = [];
    const client = clientWorker(
      'https://w',
      repondre({ codeInsee: '13001', millesime: '2025', adresses: [VALCROS] }, 200, urls),
    );
    expect(await client.adressesDvf('13001', '9001 cite valcros')).toEqual({
      ok: true,
      valeur: [VALCROS],
    });
    expect(urls).toEqual([
      `https://w/marche/adresses-dvf?codeInsee=13001&texte=9001+cite+valcros&contrat=${String(CONTRAT_ADRESSES_DVF)}`,
    ]);
    const invalide = clientWorker('https://w', repondre({ adresses: 'non' }));
    expect(await invalide.adressesDvf('13001', 'valcros')).toEqual({
      ok: false,
      code: 'REPONSE_INVALIDE',
    });
  });

  it('hors ligne', async () => {
    expect(await clientHorsLigne.suggererAdresses('abc', null)).toEqual({
      ok: false,
      code: 'HORS_LIGNE',
    });
    expect(await clientHorsLigne.adressesDvf('13001', 'abc')).toEqual({
      ok: false,
      code: 'HORS_LIGNE',
    });
  });
});
