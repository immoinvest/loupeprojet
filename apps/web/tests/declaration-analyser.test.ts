import type { BienGere } from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import {
  champsDepuisGestion,
  etatAnalyserBien,
  valeursDepuisGestion,
} from '@/gestion/declaration/analyser';

import { BIEN_BAILLE, BIEN_LICES } from './gestion-exemples';

describe('« Analyser ce bien » depuis Gérer', () => {
  it('reprend type, surface, meublé et commune ; une maison reste une maison, un studio devient un appartement', () => {
    expect(etatAnalyserBien({ ...BIEN_LICES, codePostal: '13005', ville: 'Marseille' })).toEqual({
      depuisGestion: {
        typeBien: 'appartement',
        meuble: true,
        mode: 'meuble',
        surface: 38,
        codePostal: '13005',
        ville: 'Marseille',
      },
    });
    const sansSurface: BienGere = { ...BIEN_BAILLE };
    delete sansSurface.surface;
    expect(
      etatAnalyserBien({ ...sansSurface, type: 'maison', meuble: false }).depuisGestion,
    ).toEqual({ typeBien: 'maison', meuble: false, mode: 'nu' });
  });

  it('lit l’état de navigation, rien pour une autre arrivée', () => {
    const etat = etatAnalyserBien(BIEN_LICES);
    expect(champsDepuisGestion(etat)).toEqual(etat.depuisGestion);
    expect(champsDepuisGestion(null)).toBeNull();
    expect(champsDepuisGestion('texte')).toBeNull();
    expect(champsDepuisGestion({ autre: 1 })).toBeNull();
    expect(champsDepuisGestion({ depuisGestion: 'faux' })).toBeNull();
    expect(champsDepuisGestion({ depuisGestion: null })).toBeNull();
  });

  it('les valeurs du formulaire viennent de l’utilisateur, les défauts restent estimés', () => {
    const { valeurs, provenance } = valeursDepuisGestion(
      etatAnalyserBien({ ...BIEN_LICES, codePostal: '13005', ville: 'Marseille' }).depuisGestion,
    );
    expect(valeurs.surface).toBe('38');
    expect(valeurs.codePostal).toBe('13005');
    expect(valeurs.mode).toBe('meuble');
    expect(provenance.surface).toBe('utilisateur');
    expect(provenance.ville).toBe('utilisateur');
    expect(provenance.apport).toBe('estime');
    expect(Object.values(provenance)).not.toContain('annonce');
  });
});
