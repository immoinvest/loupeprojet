import { describe, expect, it } from 'vitest';

import {
  alertesConformite,
  dateInterdiction,
  estOutreMer,
  estUrgente,
  finValiditeDpe,
  type EntreesConformite,
} from '../src/conformite';
import { DECENCE_ENERGETIQUE, GEL_LOYERS } from '../src/regles-bail';

function entrees(surcharges: Partial<EntreesConformite> = {}): EntreesConformite {
  return {
    codePostal: '13005',
    dpeClasse: 'D',
    dpeDate: '2024-03-01',
    locations: [],
    aujourdhui: '2026-09-15',
    ...surcharges,
  };
}

describe('validité du DPE', () => {
  it('2013-2017 : jusqu’au 31/12/2022 ; 2018 à juin 2021 : jusqu’au 31/12/2024 ; sinon dix ans', () => {
    expect(finValiditeDpe('2013-01-01')).toBe('2022-12-31');
    expect(finValiditeDpe('2016-05-10')).toBe('2022-12-31');
    expect(finValiditeDpe('2018-01-01')).toBe('2024-12-31');
    expect(finValiditeDpe('2021-06-30')).toBe('2024-12-31');
    expect(finValiditeDpe('2021-07-01')).toBe('2031-06-30');
    expect(finValiditeDpe('2022-03-01')).toBe('2032-02-29');
    expect(finValiditeDpe('2012-12-31')).toBe('2022-12-30');
  });
});

describe('décence énergétique', () => {
  it('métropole : G dès 2025, F dès 2028, E dès 2034, D jamais', () => {
    expect(dateInterdiction('G', '13005')).toBe('2025-01-01');
    expect(dateInterdiction('F', '13005')).toBe('2028-01-01');
    expect(dateInterdiction('E', undefined)).toBe('2034-01-01');
    expect(dateInterdiction('D', '13005')).toBeNull();
  });

  it('outre-mer (art. 73) : G dès 2028, F dès 2031, E jamais', () => {
    expect(estOutreMer('97100')).toBe(true);
    expect(estOutreMer('97600')).toBe(true);
    expect(estOutreMer('97500')).toBe(false);
    expect(estOutreMer('13005')).toBe(false);
    expect(estOutreMer(undefined)).toBe(false);
    expect(dateInterdiction('G', '97400')).toBe('2028-01-01');
    expect(dateInterdiction('F', '97400')).toBe('2031-01-01');
    expect(dateInterdiction('E', '97400')).toBeNull();
  });

  it('règles sourcées et vérifiées ; projet de loi signalé à suivre', () => {
    expect(DECENCE_ENERGETIQUE.aConfirmer).toBe(false);
    expect(DECENCE_ENERGETIQUE.aSuivre).toBe(true);
    expect(GEL_LOYERS.classes).toEqual(['F', 'G']);
  });
});

describe('alertesConformite', () => {
  it('DPE D récent : aucune alerte', () => {
    expect(alertesConformite(entrees())).toEqual([]);
  });

  it('classe G en 2026 : location interdite depuis le 01/01/2025 ; F : à partir du 01/01/2028', () => {
    expect(alertesConformite(entrees({ dpeClasse: 'G' }))).toEqual([
      { code: 'location_interdite', classe: 'G', depuis: '2025-01-01' },
    ]);
    expect(alertesConformite(entrees({ dpeClasse: 'F' }))).toEqual([
      { code: 'location_interdite_bientot', classe: 'F', aPartirDu: '2028-01-01' },
    ]);
  });

  it('DPE de 2016 : plus valable depuis le 01/01/2023 ; DPE sans classe : manquant', () => {
    expect(alertesConformite(entrees({ dpeDate: '2016-06-01' }))).toEqual([
      { code: 'dpe_perime', depuis: '2023-01-01' },
    ]);
    expect(alertesConformite(entrees({ dpeClasse: null, dpeDate: null }))).toEqual([
      { code: 'dpe_manquant' },
    ]);
  });

  it('bail étudiant ou mobilité : prévenu dans le mois qui précède la fin, pas avant ni après', () => {
    const locations: EntreesConformite['locations'] = [
      { id: 'etudiant', formeBail: 'etudiant', fin: '2026-09-30' },
      { id: 'mobilite-loin', formeBail: 'mobilite', fin: '2026-12-31' },
      { id: 'mobilite-finie', formeBail: 'mobilite', fin: '2026-09-14' },
      { id: 'mobilite-sans-fin', formeBail: 'mobilite' },
      { id: 'classique', formeBail: 'classique', fin: '2026-09-30' },
      { id: 'mobilite-limite', formeBail: 'mobilite', fin: '2026-10-15' },
    ];
    expect(alertesConformite(entrees({ locations }))).toEqual([
      { code: 'fin_bail_court', locationId: 'etudiant', forme: 'etudiant', fin: '2026-09-30' },
      {
        code: 'fin_bail_court',
        locationId: 'mobilite-limite',
        forme: 'mobilite',
        fin: '2026-10-15',
      },
    ]);
  });

  it('urgentes : interdite, périmé, fin de bail court ; pas « bientôt » ni « manquant »', () => {
    expect(estUrgente({ code: 'location_interdite', classe: 'G', depuis: '2025-01-01' })).toBe(
      true,
    );
    expect(estUrgente({ code: 'dpe_perime', depuis: '2023-01-01' })).toBe(true);
    expect(
      estUrgente({ code: 'fin_bail_court', locationId: 'l', forme: 'etudiant', fin: '2026-09-30' }),
    ).toBe(true);
    expect(
      estUrgente({ code: 'location_interdite_bientot', classe: 'F', aPartirDu: '2028-01-01' }),
    ).toBe(false);
    expect(estUrgente({ code: 'dpe_manquant' })).toBe(false);
  });
});
