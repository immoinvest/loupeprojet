import { describe, expect, it } from 'vitest';

import { projetExemple } from '../../src/exemples/t3-marseille';
import { fraisAcquisition } from '../../src/financement/frais-acquisition';
import { fraisNotaireEstimes } from '../../src/pret/frais';
import { obtenirRegles } from '../../src/regles';
import { ProjetSchema } from '../../src/schema';

const regles = obtenirRegles('2026-09');

describe('fraisNotaireEstimes', () => {
  it('donne les frais d’acquisition du projet d’exemple (honoraires exclus de l’assiette)', () => {
    const projet = ProjetSchema.parse(projetExemple);
    const attendu = fraisAcquisition(projet.hypotheses.achat, '13', regles).total;
    expect(fraisNotaireEstimes(155_000, 7_000, '13', regles)).toBeCloseTo(attendu, 8);
    // 148 000 € d'assiette : de l'ordre de 8 % du prix.
    expect(attendu).toBeGreaterThan(11_500);
    expect(attendu).toBeLessThan(12_500);
  });

  it('les honoraires réduisent l’assiette : moins de frais qu’au même prix sans honoraires', () => {
    expect(fraisNotaireEstimes(155_000, 7_000, '13', regles)).toBeLessThan(
      fraisNotaireEstimes(155_000, 0, '13', regles),
    );
    expect(fraisNotaireEstimes(148_000, 0, '13', regles)).toBeCloseTo(
      fraisNotaireEstimes(155_000, 7_000, '13', regles),
      8,
    );
  });

  it('applique le taux réduit d’un département connu, le taux par défaut sinon ou sans département', () => {
    const defaut = fraisNotaireEstimes(200_000, 0, undefined, regles);
    expect(fraisNotaireEstimes(200_000, 0, '75', regles)).toBe(defaut);
    expect(fraisNotaireEstimes(200_000, 0, '36', regles)).toBeLessThan(defaut);
    // 3,80 % au lieu de 5 % de droits départementaux sur 200 000 € : 2 400 € × (1 + 2,37 %) de moins.
    expect(defaut - fraisNotaireEstimes(200_000, 0, '36', regles)).toBeCloseTo(
      200_000 * (0.05 - 0.038) * 1.0237,
      6,
    );
  });

  it('rend 0 quand il n’y a rien à taxer (prix nul ou honoraires supérieurs au prix)', () => {
    expect(fraisNotaireEstimes(0, 0, '13', regles)).toBe(0);
    expect(fraisNotaireEstimes(5_000, 6_000, '13', regles)).toBe(0);
    // Des honoraires négatifs ne gonflent pas l'assiette.
    expect(fraisNotaireEstimes(100_000, -5_000, '13', regles)).toBe(
      fraisNotaireEstimes(100_000, 0, '13', regles),
    );
  });
});
