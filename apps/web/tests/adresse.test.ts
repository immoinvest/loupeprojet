import { describe, expect, it } from 'vitest';

import {
  clientHorsLigne,
  clientWorker,
  ecartAuRepere,
  lireCleBan,
  marcheDepuisReference,
  precisionDuGroupe,
  type Fetch,
  type ReferenceAdresse,
  type ReponseAdresse,
} from '@/enrichissement';
import {
  LIBELLES_GROUPES,
  PHRASES_ADRESSE,
  phrasePrecision,
  phraseReference,
  prixM2,
} from '@/textes/adresse';

const n = (s: string): string => s.replace(/\s/g, ' ');

const REFERENCE: ReferenceAdresse = {
  code: 'meme_cote',
  rayonMetres: 90,
  statistiques: { ventes: 6, medianeM2: 3600, q1M2: 3440, q3M2: 3750, minM2: 2929, maxM2: 4000 },
};

const ANALYSE: ReponseAdresse = {
  codeInsee: '13205',
  millesime: '2025',
  parcelle: '132058200E0318',
  parcellesVoisines: ['132058200E0319'],
  cadastre: 'ok',
  ventesCommune: 10,
  groupes: [
    {
      code: 'meme_cote',
      ventes: 6,
      comparables: 6,
      statistiques: REFERENCE.statistiques,
      distanceMaxMetres: 90,
    },
    { code: 'en_face', ventes: 0, comparables: 0, statistiques: null, distanceMaxMetres: null },
  ],
  reference: REFERENCE,
  ventesProches: [],
  sources: [],
};

function json(corps: unknown): Response {
  return new Response(JSON.stringify(corps), { headers: { 'content-type': 'application/json' } });
}

function fauxFetch(corps: unknown): Fetch & { urls: string[] } {
  const urls: string[] = [];
  return Object.assign(
    (url: string): Promise<Response> => {
      urls.push(url);
      return Promise.resolve(json(corps));
    },
    { urls },
  );
}

describe('clé BAN', () => {
  it('donne le code de la voie et le numéro, ou rien', () => {
    expect(lireCleBan('13205_6659_00144')).toEqual({ codeVoie: '6659', numero: 144 });
    expect(lireCleBan('13205_b180_00012_bis')).toEqual({ codeVoie: 'B180', numero: 12 });
    expect(lireCleBan('2A004_A090_09001')).toEqual({ codeVoie: 'A090', numero: 9001 });
    expect(lireCleBan('13205_0693')).toEqual({ codeVoie: '0693', numero: null });
    expect(lireCleBan('13205')).toBeNull();
    expect(lireCleBan(null)).toBeNull();
    expect(lireCleBan(undefined)).toBeNull();
  });
});

describe('repère de l’analyse d’adresse', () => {
  it('devient le bloc marche.dvf du moteur, avec le rayon et la provenance', () => {
    expect(marcheDepuisReference(REFERENCE)).toEqual({
      dvf: {
        medianM2: 3600,
        q1M2: 3440,
        q3M2: 3750,
        nombreVentes: 6,
        rayonMetres: 90,
        precision: 'rue',
      },
      provenance: {
        'marche.dvf.medianM2': 'dvf',
        'marche.dvf.q1M2': 'dvf',
        'marche.dvf.q3M2': 'dvf',
        'marche.dvf.nombreVentes': 'dvf',
        'marche.dvf.rayonMetres': 'dvf',
      },
    });
    expect(marcheDepuisReference(REFERENCE, '2025-S1').dvf).toEqual({
      medianM2: 3600,
      q1M2: 3440,
      q3M2: 3750,
      nombreVentes: 6,
      rayonMetres: 90,
      precision: 'rue',
      actualiseAu: '2025-S1',
    });
    expect(ecartAuRepere(2700, 3600)).toBeCloseTo(-0.25, 10);
  });

  it('garde la période et l’ancienneté des ventes du repère, et déduit la précision du groupe', () => {
    const complet = marcheDepuisReference({
      ...REFERENCE,
      code: 'rayon_200',
      dateMediane: '2025-03-01',
      periode: { debut: '2024-11-02', fin: '2025-03-01' },
      ancienneteMedianeMois: 18,
    });
    expect(complet.dvf).toMatchObject({
      precision: 'quartier',
      periode: { debut: '2024-11-02', fin: '2025-03-01' },
      ancienneteMedianeMois: 18,
    });
    expect(complet.provenance['marche.dvf.ancienneteMedianeMois']).toBe('dvf');
    expect(
      marcheDepuisReference({ ...REFERENCE, periode: null, ancienneteMedianeMois: null }).dvf,
    ).not.toHaveProperty('periode');
    expect(precisionDuGroupe('meme_parcelle')).toBe('immeuble');
    expect(precisionDuGroupe('parcelles_voisines')).toBe('immeuble');
    expect(precisionDuGroupe('en_face')).toBe('rue');
    expect(precisionDuGroupe('rayon_100')).toBe('quartier');
    expect(precisionDuGroupe('rayon_300')).toBe('quartier');
  });
});

describe('textes de l’analyse d’adresse', () => {
  it('libellés, précision du géocodage, repère', () => {
    expect(Object.keys(LIBELLES_GROUPES)).toHaveLength(7);
    expect(phrasePrecision('adresse')).toBeNull();
    expect(phrasePrecision('rue')).toContain('ajoutez le numéro');
    expect(phrasePrecision('commune')).toContain('trop imprécise');
    expect(n(prixM2(3600))).toBe('3 600 €/m²');
    expect(n(phraseReference(REFERENCE, -0.3376))).toBe(
      'Même côté de la rue : 6 ventes comparables, médiane 3 600 €/m². Ce bien est à −34 %.',
    );
    expect(PHRASES_ADRESSE.sansRepere).toContain('pas de repère');
  });
});

describe('client : analyse d’adresse', () => {
  it('passe numéro et code de voie quand ils sont connus, et valide la réponse', async () => {
    const f = fauxFetch(ANALYSE);
    const client = clientWorker('https://worker.test', f);
    const parametres = {
      codeInsee: '13205',
      lat: 43.294813,
      lon: 5.393807,
      numero: 144,
      codeVoie: '6659',
      type: 'appartement' as const,
      surface: 65,
    };
    expect(await client.analyserAdresse(parametres)).toEqual({ ok: true, valeur: ANALYSE });
    await client.analyserAdresse({ ...parametres, numero: null, codeVoie: null });
    await client.geocoder('144 rue de l’Olivier 13005 Marseille');
    expect(f.urls).toEqual([
      'https://worker.test/marche/adresse?codeInsee=13205&lat=43.294813&lon=5.393807&type=appartement&surface=65&numero=144&codeVoie=6659&contrat=6',
      'https://worker.test/marche/adresse?codeInsee=13205&lat=43.294813&lon=5.393807&type=appartement&surface=65&contrat=6',
      'https://worker.test/proxy/geocodage?q=144+rue+de+l%E2%80%99Olivier+13005+Marseille&limit=1',
    ]);
    expect(
      await clientHorsLigne.analyserAdresse({ ...parametres, numero: null, codeVoie: null }),
    ).toEqual({ ok: false, code: 'HORS_LIGNE' });
  });
});
