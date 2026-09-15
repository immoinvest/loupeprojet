import { AchatSchema, fraisAcquisition } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import { REGLES } from '../src/lib/regles';
import { calculerRentabilite, lireMontant, type SaisieSimulateur } from '../src/lib/simulateur';

const SAISIE: SaisieSimulateur = {
  prix: '150 000 €',
  departement: '13',
  travaux: '',
  loyer: '650',
  charges: '1 900',
};

describe('lireMontant', () => {
  it.each([
    ['150000', 150000],
    ['150 000 €', 150000],
    ['150 000 €', 150000],
    ['1 900,50', 1900.5],
    ['-12', -12],
  ])('lit « %s »', (texte, attendu) => {
    expect(lireMontant(texte)).toBe(attendu);
  });

  it.each(['', '   ', 'abc', '12,5,3', '1e5'])('refuse « %s »', (texte) => {
    expect(lireMontant(texte)).toBeNull();
  });
});

describe('calculerRentabilite', () => {
  it('calcule frais, coût total et rendements avec le moteur de l’application', () => {
    const calcul = calculerRentabilite(SAISIE);
    const frais = fraisAcquisition(AchatSchema.parse({ prix: 150000 }), '13', REGLES).total;
    expect(calcul).toEqual({
      ok: true,
      resultat: {
        fraisAcquisition: frais,
        coutTotal: 150000 + frais,
        brut: 7800 / (150000 + frais),
        net: (7800 - 1900) / (150000 + frais),
      },
    });
    // Ordre de grandeur vérifié à la main : 5 % de droits + émoluments ≈ 7 à 8 % du prix dans l'ancien.
    expect(frais).toBeGreaterThan(10_500);
    expect(frais).toBeLessThan(12_500);
  });

  it('ajoute les travaux au coût total, en minuscules ou majuscules pour la Corse', () => {
    const calcul = calculerRentabilite({ ...SAISIE, travaux: '10 000', departement: '2a' });
    expect(calcul.ok && calcul.resultat.coutTotal - calcul.resultat.fraisAcquisition).toBe(160000);
  });

  it.each<[keyof SaisieSimulateur, string]>([
    ['prix', ''],
    ['prix', '0'],
    ['departement', '99'],
    ['travaux', 'beaucoup'],
    ['travaux', '-5'],
    ['loyer', ''],
    ['charges', 'n/a'],
    ['charges', '-1'],
  ])('nomme le champ « %s » quand il vaut « %s »', (champ, valeur) => {
    const calcul = calculerRentabilite({ ...SAISIE, [champ]: valeur });
    expect(calcul.ok).toBe(false);
    expect(calcul.ok ? [] : Object.keys(calcul.erreurs)).toEqual([champ]);
  });
});
