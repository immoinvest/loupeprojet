import { calculerProjet, projetExemple, type ResultatsComplets } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import {
  LIGNES_REVENTE,
  anneeRepriseDeficit,
  avertissementRepriseDeficit,
  explicationRegime,
  impotDuAuxAmortissements,
} from '@/textes/regimes';

const n = (s: string): string => s.replace(/\s/g, ' ');

function complet(): ResultatsComplets {
  const r = calculerProjet(projetExemple, { avecScenarios: false });
  if (!r.complet) throw new Error('projet d’exemple incomplet');
  return r;
}

describe('impotDuAuxAmortissements', () => {
  it('écart d’impôt à la revente entre le meublé au réel et le micro-BIC', () => {
    const f = complet().fiscalite;
    expect(impotDuAuxAmortissements(f)).toBeCloseTo(
      f.regimes.lmnp_reel.impotRevente - f.regimes.micro_bic.impotRevente,
      8,
    );
  });

  it('jamais négatif', () => {
    const f = complet().fiscalite;
    const inverse = {
      ...f,
      regimes: {
        ...f.regimes,
        micro_bic: { ...f.regimes.micro_bic, impotRevente: f.regimes.lmnp_reel.impotRevente + 100 },
      },
    };
    expect(impotDuAuxAmortissements(inverse)).toBe(0);
  });
});

describe('anneeRepriseDeficit', () => {
  const f = complet().fiscalite;
  const avecDeficit = {
    ...f.regimes.nu_reel,
    annees: f.regimes.nu_reel.annees.map((a) => ({
      ...a,
      deficitImputeRevenuGlobal: a.annee === 1 ? 5_000 : 0,
    })),
  };
  const sansDeficit = {
    ...avecDeficit,
    annees: avecDeficit.annees.map((a) => ({ ...a, deficitImputeRevenuGlobal: 0 })),
  };

  it('nu au réel : revendre avant la fin de la 3ᵉ année qui suit le déficit', () => {
    expect(anneeRepriseDeficit(avecDeficit, 3)).toBe(1);
    expect(anneeRepriseDeficit(avecDeficit, 4)).toBeNull();
    expect(anneeRepriseDeficit(sansDeficit, 2)).toBeNull();
  });

  it('les autres régimes ne sont jamais concernés', () => {
    expect(anneeRepriseDeficit({ ...avecDeficit, regime: 'micro_foncier' }, 2)).toBeNull();
  });

  it('dit l’année limite', () => {
    expect(avertissementRepriseDeficit(1)).toContain("avant la fin de l'année 4");
    expect(avertissementRepriseDeficit(1)).toContain("l'année 1");
  });
});

describe('LIGNES_REVENTE', () => {
  it('onze lignes lues dans la revente du régime', () => {
    const revente = complet().fiscalite.regimes.lmnp_reel.revente;
    const valeurs = Object.fromEntries(LIGNES_REVENTE.map((l) => [l.titre, n(l.valeur(revente))]));
    expect(LIGNES_REVENTE).toHaveLength(11);
    expect(valeurs['Abattement impôt sur le revenu']).toBe('30 %');
    // 10 ans de détention : 5 × 1,65 % de prélèvements sociaux, jamais arrondi à 8 %.
    expect(valeurs['Abattement prélèvements sociaux']).toBe('8,25 %');
    expect(valeurs['Impôt à la revente']).toBe(
      n(`${Math.round(revente.plusValue.impotTotal).toLocaleString('fr-FR')} €`),
    );
    expect(LIGNES_REVENTE.filter((l) => l.fort === true).map((l) => l.titre)).toEqual([
      'Impôt à la revente',
      'Cash net de revente',
    ]);
  });
});

describe('explicationRegime — revente', () => {
  const reel = complet().fiscalite.regimes.lmnp_reel;

  it('meublé au réel : l’impôt à la revente dû aux amortissements quand il existe', () => {
    const avec = explicationRegime(reel, 10, 6_100);
    expect(n(avec)).toContain("6 100 € d'impôt s'ajoutent à la revente");
    expect(avec).toContain('résidence services');
    expect(explicationRegime(reel, 10)).not.toContain('revente');
  });

  it('avec ou sans premier impôt pendant la location', () => {
    expect(explicationRegime({ ...reel, premiereAnneeImposable: null }, 10, 100)).toContain(
      'aucun impôt sur 10 ans',
    );
    expect(explicationRegime({ ...reel, premiereAnneeImposable: 7 }, 10, 100)).toContain(
      "jusqu'à l'année 7",
    );
  });
});
