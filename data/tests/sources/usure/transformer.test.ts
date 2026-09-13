import { describe, expect, it } from 'vitest';
import type { SaisieUsure } from '../../../src/schemas/usure.ts';
import {
  ErreurSaisieUsure,
  publierUsure,
  verifierSaisie,
} from '../../../src/sources/usure/transformer.ts';

const T2: SaisieUsure = {
  trimestre: '2026-T2',
  applicableDu: '2026-04-01',
  publieLe: '2026-03-27',
  source: {
    nom: 'Banque de France, taux d’usure 2026-T2',
    url: 'https://www.banque-france.fr/fr/statistiques/taux-et-cours/taux-dusure-2026-q2',
    licence: 'Banque de France',
  },
  tauxEffectifsMoyens: {
    fixeMoins10Ans: 0.03,
    fixe10a20Ans: 0.0336,
    fixe20AnsEtPlus: 0.0389,
    variable: 0.0375,
    relais: 0.0465,
  },
  seuils: {
    fixeMoins10Ans: 0.04,
    fixe10a20Ans: 0.0448,
    fixe20AnsEtPlus: 0.0519,
    variable: 0.05,
    relais: 0.062,
  },
};

const T3: SaisieUsure = {
  ...T2,
  trimestre: '2026-T3',
  applicableDu: '2026-07-01',
  publieLe: '2026-06-29',
  tauxEffectifsMoyens: {
    fixeMoins10Ans: 0.0305,
    fixe10a20Ans: 0.0343,
    fixe20AnsEtPlus: 0.0397,
    variable: 0.0396,
    relais: 0.0479,
  },
  seuils: {
    fixeMoins10Ans: 0.0407,
    fixe10a20Ans: 0.0457,
    fixe20AnsEtPlus: 0.0529,
    variable: 0.0528,
    relais: 0.0639,
  },
};

const GENERE_LE = '2026-09-13T10:00:00.000Z';

describe('verifierSaisie', () => {
  it('accepte les publications réelles de 2026', () => {
    expect(() => {
      verifierSaisie(T2);
      verifierSaisie(T3);
    }).not.toThrow();
  });

  it('refuse un trimestre qui ne correspond pas à la date d’application', () => {
    expect(() => {
      verifierSaisie({ ...T3, applicableDu: '2026-10-01' });
    }).toThrow(ErreurSaisieUsure);
  });

  it('refuse un seuil qui n’est pas le taux moyen augmenté d’un tiers', () => {
    expect(() => {
      verifierSaisie({ ...T3, seuils: { ...T3.seuils, fixe20AnsEtPlus: 0.0539 } });
    }).toThrow('2026-T3 fixe20AnsEtPlus : seuil 0.0539 au lieu de 0.0529');
  });
});

describe('publierUsure', () => {
  it('publie chaque trimestre et désigne le plus récent applicable, non périmé dans son trimestre', () => {
    const publication = publierUsure([T3, T2], '2026-09-13', GENERE_LE);
    expect(publication.trimestres.map((trimestre) => trimestre.trimestre)).toEqual([
      '2026-T2',
      '2026-T3',
    ]);
    expect(publication.trimestres[0]?.perime).toBe(true);
    expect(publication.courant).toMatchObject({
      genereLe: GENERE_LE,
      millesime: '2026-T3',
      trimestre: '2026-T3',
      seuils: { fixe20AnsEtPlus: 0.0529 },
      perime: false,
    });
  });

  it('marque le courant périmé quand le trimestre du jour n’est pas saisi', () => {
    const publication = publierUsure([T2, T3], '2026-10-15', GENERE_LE);
    expect(publication.courant).toMatchObject({ trimestre: '2026-T3', perime: true });
  });

  it('ne désigne pas un trimestre pas encore applicable', () => {
    expect(publierUsure([T2, T3], '2026-05-01', GENERE_LE).courant?.trimestre).toBe('2026-T2');
    expect(publierUsure([T3], '2026-05-01', GENERE_LE).courant).toBeNull();
  });

  it('refuse deux saisies du même trimestre', () => {
    expect(() => publierUsure([T3, { ...T3 }], '2026-09-13', GENERE_LE)).toThrow('saisi deux fois');
  });
});
