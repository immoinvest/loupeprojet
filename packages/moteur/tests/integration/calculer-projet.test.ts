import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { calculerProjet } from '../../src/calculer-projet';
import { projetExemple } from '../../src/exemples/t3-marseille';
import { ResultatsSchema } from '../../src/schema/resultats';
import type { ProjetEntree } from '../../src/schema';

describe('calculerProjet — T3 Marseille', () => {
  const resultats = calculerProjet(projetExemple);

  it('rend un rapport complet que le schéma de sortie accepte tel quel', () => {
    expect(() => ResultatsSchema.parse(resultats)).not.toThrow();
    expect(resultats.projet.hypotheses.location.vacanceSemaines).toBe(3);
    expect(resultats.financement.montantEmprunte).toBeCloseTo(161_000, 0);
    expect(resultats.cashflow.regime).toBe('lmnp_reel');
    expect(resultats.fiscalite.retenu).toBe('lmnp_reel');
    expect(resultats.revente.annees).toBe(10);
    expect(resultats.rendement.tri).not.toBeNull();
    expect(resultats.verdict.feux).toHaveLength(5);
    expect(resultats.scenarios?.scenarios).toHaveLength(6);
    expect(resultats.scenarios?.prixCibles).toHaveLength(3);
  });

  it('estime le prix du bien et juge le prix affiché contre cette estimation', () => {
    expect(resultats.estimation).toMatchObject({ centre: 206_733, prixM2Estime: 3181 });
    expect(resultats.verdict.feux[0]?.valeur).toBeCloseTo(155_000 / 65 / 3181 - 1, 6);
    expect(resultats.meta.aConfirmer).toContain('estimation.dpe');
  });

  it('ne manque de rien ; sans revenus, seul le feu effort devient inconnu', () => {
    expect(resultats.manques).toEqual([]);
    const hypotheses = Object.fromEntries(
      Object.entries(projetExemple.hypotheses).filter(([k]) => k !== 'revenusMensuels'),
    ) as ProjetEntree['hypotheses'];
    const sansRevenus = calculerProjet({ ...projetExemple, hypotheses });
    expect(sansRevenus.manques).toEqual([
      { code: 'REVENUS_ABSENTS', champ: 'hypotheses.revenusMensuels' },
    ]);
    expect(sansRevenus.financement.effort.hcsf).toBeNull();
    expect(sansRevenus.verdict.feux[3]).toMatchObject({
      feu: 'inconnu',
      raison: 'REVENUS_ABSENTS',
    });
    expect(sansRevenus.cashflow.mensuel).toBeCloseTo(resultats.cashflow.mensuel, 6);
    expect(sansRevenus.rendement.tri).toBe(resultats.rendement.tri);
    expect(() => ResultatsSchema.parse(sansRevenus)).not.toThrow();
  });

  it('porte la version des règles et les drapeaux à afficher', () => {
    expect(resultats.meta.versionRegles).toBe('2026-09');
    expect(resultats.meta.aConfirmer).toContain('fiscalite.prelevementsSociaux.bic');
    expect(resultats.meta.simplifications.length).toBeGreaterThan(3);
  });

  it('ne contient aucun NaN ni infini', () => {
    const chiffres: number[] = [];
    const visiter = (v: unknown): void => {
      if (typeof v === 'number') chiffres.push(v);
      else if (Array.isArray(v)) v.forEach(visiter);
      else if (v !== null && typeof v === 'object') Object.values(v).forEach(visiter);
    };
    visiter(resultats);
    expect(chiffres.length).toBeGreaterThan(1_000);
    expect(chiffres.every((c) => Number.isFinite(c))).toBe(true);
  });
});

describe('calculerProjet — pureté et robustesse', () => {
  it('deux appels donnent des résultats strictement égaux et ne mutent pas l’entrée', () => {
    const copie = structuredClone(projetExemple);
    const a = calculerProjet(projetExemple);
    const b = calculerProjet(projetExemple);
    expect(a).toEqual(b);
    expect(projetExemple).toEqual(copie);
  });

  it('applique les défauts à une entrée minimale', () => {
    const { achat, pret, location, fiscalite, revenusMensuels } = projetExemple.hypotheses;
    const minimal: ProjetEntree = {
      id: 'minimal',
      versionRegles: '2026-09',
      bien: { type: 'appartement', surface: 40, pieces: 2, departement: '69' },
      hypotheses: { achat, pret, location, fiscalite, revenusMensuels },
    };
    const r = calculerProjet(minimal);
    expect(r.verdict.feux[0]?.feu).toBe('inconnu');
    expect(r.revente.annees).toBe(10);
    expect(() => ResultatsSchema.parse(r)).not.toThrow();
  });

  it('refuse une entrée invalide avec une erreur Zod nommant le champ', () => {
    const invalide = {
      ...projetExemple,
      hypotheses: {
        ...projetExemple.hypotheses,
        pret: { ...projetExemple.hypotheses.pret, dureeAnnees: 0 },
      },
    };
    expect(() => calculerProjet(invalide)).toThrow(ZodError);
    expect(() => calculerProjet({ ...projetExemple, versionRegles: '2031-01' } as never)).toThrow(
      ZodError,
    );
  });

  it('peut désactiver les scénarios', () => {
    const r = calculerProjet(projetExemple, { avecScenarios: false });
    expect(r.scenarios).toBeNull();
    expect(() => ResultatsSchema.parse(r)).not.toThrow();
  });

  it(
    'calcule un projet complet (6 scénarios, 3 prix cibles) en moins de 500 ms en moyenne',
    { timeout: 30_000 },
    () => {
      // Mesuré à ~35 ms en isolation ; l'instrumentation de couverture et les tests en parallèle
      // (jsdom compris) multiplient la mesure jusqu'à 250 ms sur une machine chargée.
      calculerProjet(projetExemple);
      const debut = performance.now();
      for (let i = 0; i < 10; i += 1) calculerProjet(projetExemple);
      const moyenne = (performance.now() - debut) / 10;
      // Garde-fou contre une régression d'un ordre de grandeur, pas une mesure fine.
      expect(moyenne).toBeLessThan(500);
    },
  );
});
