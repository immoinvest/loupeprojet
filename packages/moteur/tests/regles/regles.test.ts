import { describe, expect, it } from 'vitest';

import { ErreurVersionRegles } from '../../src/commun/erreurs';
import { VERSION_REGLES_COURANTE, obtenirRegles } from '../../src/regles';

const cumul = (
  periodes: readonly { deAnnee: number; aAnnee: number; tauxParAn: number }[],
): number => periodes.reduce((acc, p) => acc + (p.aAnnee - p.deAnnee + 1) * p.tauxParAn, 0);

describe('obtenirRegles', () => {
  it('rend les règles 2026-09', () => {
    const regles = obtenirRegles('2026-09');
    expect(regles.version).toBe('2026-09');
    expect(VERSION_REGLES_COURANTE).toBe('2026-09');
  });

  it('lève ErreurVersionRegles pour une version inconnue', () => {
    expect(() => obtenirRegles('2031-01')).toThrow(ErreurVersionRegles);
  });
});

describe('règles 2026-09', () => {
  const regles = obtenirRegles('2026-09');

  it('marque les prélèvements sociaux BIC comme à confirmer', () => {
    expect(regles.fiscalite.prelevementsSociaux.bic).toBe(0.186);
    expect(regles.aConfirmer).toContain('fiscalite.prelevementsSociaux.bic');
  });

  it('a des composants d’amortissement qui couvrent 100 % du bâti', () => {
    const total = regles.fiscalite.amortissement.composants.reduce((acc, c) => acc + c.part, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('exonère la plus-value d’IR à 22 ans et de PS à 30 ans', () => {
    expect(cumul(regles.fiscalite.plusValue.abattementIr)).toBeCloseTo(1, 10);
    expect(cumul(regles.fiscalite.plusValue.abattementPs)).toBeCloseTo(1, 10);
  });

  it('a des tranches d’émoluments croissantes et une dernière tranche ouverte', () => {
    const bornes = regles.acquisition.emoluments.map((t) => t.jusqua);
    expect(bornes.at(-1)).toBeNull();
    const fermees = bornes.filter((b): b is number => b !== null);
    expect([...fermees].sort((a, b) => a - b)).toEqual(fermees);
  });

  it('borne les taux moyens par le taux d’usure', () => {
    for (const taux of Object.values(regles.credit.tauxMoyens)) {
      expect(taux).toBeLessThan(regles.credit.tauxUsure);
    }
  });

  it('porte les seuils datés de la liste de visite', () => {
    expect(regles.visite.amianteAvantAnnee).toBe(1997);
    expect(regles.visite.plombAvantAnnee).toBe(1949);
    expect(regles.visite.plombAvantAnnee).toBeLessThan(regles.visite.amianteAvantAnnee);
    expect(regles.visite.installationsAnciennesAns).toBe(15);
    expect(regles.visite.etageSansAscenseur).toBe(3);
    expect(regles.visite.chambreColocationM2).toBe(9);
  });

  it('a des barèmes de confiance cohérents : 100 points, paliers triés, niveaux jusqu’à zéro, marges croissantes', () => {
    const c = regles.estimation.confiance;
    const maximum = (paliers: readonly { points: number }[]): number =>
      Math.max(...paliers.map((p) => p.points));
    const localisation = Math.max(
      c.localisation.immeuble,
      c.localisation.rue.points,
      c.localisation.commune,
      maximum(c.localisation.quartier),
    );
    // Une rue compte comme une rue dans une distance plus courte que le dernier cercle fermé.
    const cercles = c.localisation.quartier.flatMap((p) =>
      p.jusquaMetres === null ? [] : [p.jusquaMetres],
    );
    expect(c.localisation.rue.jusquaMetres).toBeGreaterThan(0);
    expect(c.localisation.rue.jusquaMetres).toBeLessThan(Math.max(...cercles));
    expect(
      localisation + maximum(c.comparables) + maximum(c.dispersion) + maximum(c.anciennete),
    ).toBe(100);
    for (const bareme of [c.comparables, c.dispersion, c.anciennete]) {
      const valeurs = bareme.map((p) => p.valeur);
      expect([...valeurs].sort((a, b) => a - b)).toEqual(valeurs);
    }
    expect(c.localisation.quartier.at(-1)?.jusquaMetres).toBeNull();
    expect(c.niveaux.at(-1)?.des).toBe(0);
    const seuils = c.niveaux.map((s) => s.des);
    expect([...seuils].sort((a, b) => b - a)).toEqual(seuils);
    const marges = c.niveaux.map((s) => regles.estimation.marges[s.niveau]);
    expect([...marges].sort((a, b) => a - b)).toEqual(marges);
  });
});
