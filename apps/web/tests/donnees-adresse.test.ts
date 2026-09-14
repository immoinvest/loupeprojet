import { ProjetSchema, projetExemple } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import {
  appliquerDpe,
  appliquerLoyerReference,
  appliquerLoyerVise,
  appliquerRisques,
  classerDpe,
  cleBanAdresse,
  clientHorsLigne,
  clientWorker,
  dpeSuggere,
  loyerPourBien,
  loyerVise,
  memesRisques,
  risquesDuProjet,
  type DpeAdresse,
  type ReponseRisques,
} from '@/enrichissement';
import { descriptionDpe, libelleRisque, phraseLoyer } from '@/textes/donnees-adresse';

const n = (s: string): string => s.replace(/\s/g, ' ');
const projet = ProjetSchema.parse(projetExemple);

const dpe = (o: Partial<DpeAdresse>): DpeAdresse => ({
  numero: 'X',
  date: '2024-01-01',
  finValidite: '2034-01-01',
  etiquetteDpe: 'D',
  etiquetteGes: 'D',
  typeBatiment: 'appartement',
  surface: 65,
  etage: 3,
  complement: null,
  cleBan: '13205_6659_00144',
  anneeConstruction: null,
  distanceMetres: 0,
  ...o,
});

describe('DPE de l’adresse', () => {
  const CLE = '13205_6659_00144';
  const LISTE = [
    dpe({ numero: 'A', surface: 64.1, etage: 0, date: '2024-11-06', complement: 'Rdc' }),
    dpe({ numero: 'B', surface: 72.5, etage: 1, date: '2024-07-08' }),
    dpe({
      numero: 'C',
      typeBatiment: 'immeuble',
      surface: null,
      etage: null,
      cleBan: '13205_6659_00146',
      date: '2026-03-30',
    }),
    dpe({
      numero: 'E',
      surface: 30,
      etage: 3,
      cleBan: null,
      date: '2010-01-01',
      finValidite: '2020-01-01',
    }),
    dpe({ numero: 'F', surface: null, etage: null, cleBan: null, date: null }),
    dpe({ numero: 'G', surface: null, etage: null, cleBan: null, date: null, finValidite: null }),
  ];

  it('clé BAN de l’adresse au format des DPE', () => {
    expect(cleBanAdresse('13205', '6659', 144)).toBe(CLE);
    expect(cleBanAdresse('13205', 'B180', 12)).toBe('13205_b180_00012');
    expect(cleBanAdresse('13205', null, 12)).toBeNull();
    expect(cleBanAdresse('13205', '6659', null)).toBeNull();
  });

  it('classe par même adresse, surface proche, étage, puis date ; signale expirés et immeubles', () => {
    const classes = classerDpe(LISTE, { surface: 65, etage: 3 }, CLE, '2026-09-14');
    expect(classes.map((c) => c.dpe.numero)).toEqual(['A', 'B', 'E', 'F', 'G', 'C']);
    expect(classes[0]).toMatchObject({
      raisons: ['meme_adresse', 'surface'],
      expire: false,
      immeuble: false,
    });
    expect(classes.find((c) => c.dpe.numero === 'E')).toMatchObject({
      raisons: ['etage'],
      expire: true,
    });
    expect(classes.find((c) => c.dpe.numero === 'C')).toMatchObject({
      raisons: [],
      immeuble: true,
    });
    expect(dpeSuggere(classes)?.dpe.numero).toBe('A');

    const sansEtage = classerDpe(
      [dpe({ cleBan: '13205_B180_00012', surface: 100 })],
      { surface: 65 },
      cleBanAdresse('13205', 'B180', 12),
      '2026-09-14',
    );
    expect(sansEtage[0]?.raisons).toEqual(['meme_adresse']);
    expect(dpeSuggere(sansEtage)).toBeNull();
    expect(dpeSuggere([])).toBeNull();
    expect(
      dpeSuggere(classerDpe([LISTE[3]!], { surface: 65, etage: 3 }, null, '2026-09-14'))?.dpe
        .numero,
    ).toBe('E');
  });

  it('applique étiquettes énergie et climat, provenance « ademe »', () => {
    const avecGes = appliquerDpe(projet, dpe({ etiquetteDpe: 'E', etiquetteGes: 'C' }));
    expect(avecGes.bien).toMatchObject({ dpe: 'E', ges: 'C' });
    expect(avecGes.provenance).toMatchObject({ 'bien.dpe': 'ademe', 'bien.ges': 'ademe' });
    const sansGes = appliquerDpe(projet, dpe({ etiquetteDpe: 'F', etiquetteGes: null }));
    expect(sansGes.bien).toMatchObject({ dpe: 'F', ges: 'B' });
    expect(sansGes.provenance['bien.ges']).toBeUndefined();
  });

  it('décrit un DPE en une ligne', () => {
    expect(n(descriptionDpe(LISTE[0]!))).toMatch(/^Rdc · 64,1 m² · DPE du /);
    expect(descriptionDpe(dpe({ typeBatiment: 'immeuble', surface: null, date: null }))).toBe(
      'Immeuble entier',
    );
    expect(n(descriptionDpe(dpe({ etage: 0, date: null })))).toBe('Rez-de-chaussée · 65 m²');
    expect(n(descriptionDpe(dpe({ etage: 2, surface: null, date: null })))).toBe('2e étage');
    expect(descriptionDpe(dpe({ etage: null, surface: null, date: null }))).toBe('Logement');
  });
});

describe('risques de l’adresse', () => {
  const REPONSE: ReponseRisques = {
    url: null,
    risques: [
      {
        code: 'retraitGonflementArgile',
        famille: 'naturel',
        libelle: 'Argiles',
        adresse: 'fort',
        commune: 'fort',
      },
      { code: 'radon', famille: 'naturel', libelle: 'Radon', adresse: 'faible', commune: 'moyen' },
      { code: 'seisme', famille: 'naturel', libelle: 'Séisme', adresse: 'moyen', commune: 'moyen' },
      {
        code: 'inondation',
        famille: 'naturel',
        libelle: 'Inondation',
        adresse: 'inconnu',
        commune: 'moyen',
      },
      {
        code: 'icpe',
        famille: 'technologique',
        libelle: 'ICPE',
        adresse: 'absent',
        commune: 'moyen',
      },
    ],
  };

  it('seuls les risques présents à l’adresse vont au projet', () => {
    const risques = risquesDuProjet(REPONSE);
    expect(risques).toEqual([
      { type: 'retraitGonflementArgile', niveau: 'fort' },
      { type: 'radon', niveau: 'faible' },
      { type: 'seisme', niveau: 'moyen' },
    ]);
    expect(memesRisques(risques, [...risques].reverse())).toBe(true);
    expect(memesRisques(risques, [{ type: 'radon', niveau: 'fort' }])).toBe(false);
    const applique = appliquerRisques(projet, risques);
    expect(applique.marche.risques).toEqual(risques);
    expect(applique.provenance['marche.risques']).toBe('georisques');
    expect(libelleRisque('retraitGonflementArgile')).toBe('retrait-gonflement des argiles');
    expect(libelleRisque('argiles')).toBe('argiles');
  });
});

describe('loyer de marché', () => {
  // ANIL 15 €/m² charges comprises → 13,80 €/m² hors charges × 65 m² = 897 € ; meublé +15 % = 1 032 €.
  const loyer = loyerPourBien({ loyerM2: 15, basM2: 12, hautM2: 19, observations: 100 }, 65, 0.15);

  it('ramène l’ANIL hors charges, à la surface, en nu et en meublé', () => {
    expect(loyer).toEqual({
      referenceM2: 13.8,
      nuMensuel: 897,
      meubleMensuel: 1032,
      basMensuel: 718,
      hautMensuel: 1136,
    });
    expect(loyerVise(loyer, 'nu')).toBe(897);
    expect(loyerVise(loyer, 'meuble')).toBe(1032);
    expect(loyerVise(loyer, 'courte_duree')).toBe(1032);
    expect(n(phraseLoyer(loyer))).toBe(
      '897 € par mois hors charges en location nue, 1 032 € en meublé ; fourchette des annonces : 718 € à 1 136 €.',
    );
  });

  it('devient le loyer de référence, puis le loyer visé sur demande', () => {
    const reference = appliquerLoyerReference(projet, loyer);
    expect(reference.marche.loyerReferenceM2).toBe(13.8);
    expect(reference.provenance['marche.loyerReferenceM2']).toBe('anil');
    const vise = appliquerLoyerVise(projet, loyer);
    expect(vise.hypotheses.location).toMatchObject({ loyerHc: 1032 });
    expect(vise.provenance['location.loyerHc']).toBe('anil');
  });
});

describe('client : DPE et risques', () => {
  it('appelle le proxy du Worker et revalide la réponse', async () => {
    const urls: string[] = [];
    const client = clientWorker('https://w.test', (url) => {
      urls.push(url);
      const donnees = url.includes('/proxy/dpe')
        ? { dpe: [dpe({ numero: 'A' })] }
        : { url: null, risques: [] };
      return Promise.resolve(
        new Response(JSON.stringify({ service: 'x', obtenuLe: 'x', donnees })),
      );
    });
    const d = await client.dpe({ lat: 43.29, lon: 5.39 });
    expect(d.ok && d.valeur.map((x) => x.numero)).toEqual(['A']);
    const r = await client.risques({ lat: 43.29, lon: 5.39 });
    expect(r).toEqual({ ok: true, valeur: { url: null, risques: [] } });
    expect(urls).toEqual([
      'https://w.test/proxy/dpe?lat=43.29&lon=5.39',
      'https://w.test/proxy/risques?lat=43.29&lon=5.39',
    ]);

    const invalide = clientWorker('https://w.test', () =>
      Promise.resolve(new Response(JSON.stringify({ donnees: { dpe: 'non', risques: 'non' } }))),
    );
    expect(await invalide.dpe({ lat: 1, lon: 1 })).toEqual({ ok: false, code: 'REPONSE_INVALIDE' });
    expect(await invalide.risques({ lat: 1, lon: 1 })).toEqual({
      ok: false,
      code: 'REPONSE_INVALIDE',
    });
    expect(await clientHorsLigne.dpe({ lat: 1, lon: 1 })).toEqual({
      ok: false,
      code: 'HORS_LIGNE',
    });
    expect(await clientHorsLigne.risques({ lat: 1, lon: 1 })).toEqual({
      ok: false,
      code: 'HORS_LIGNE',
    });
  });
});
