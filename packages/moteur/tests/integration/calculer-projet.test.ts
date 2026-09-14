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
    const { achat, pret, location, fiscalite } = projetExemple.hypotheses;
    const minimal: ProjetEntree = {
      id: 'minimal',
      versionRegles: '2026-09',
      bien: { type: 'appartement', surface: 40, pieces: 2, departement: '69' },
      hypotheses: { achat, pret, location, fiscalite },
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

describe('calculerProjet — négociation du prix', () => {
  const avecNegociation = (negociationTaux: number): ProjetEntree => ({
    ...projetExemple,
    hypotheses: {
      ...projetExemple.hypotheses,
      achat: { ...projetExemple.hypotheses.achat, negociationTaux },
    },
  });
  const reference = calculerProjet(projetExemple);

  it('à négociation nulle explicite, le rapport est strictement identique à la référence', () => {
    expect(calculerProjet(avecNegociation(0))).toEqual(reference);
    expect(reference.achat).toEqual({
      prixAffiche: 155_000,
      prixRetenu: 155_000,
      negociationTaux: 0,
      negociationMontant: 0,
    });
  });

  it('négocié à 5 % : tout est calculé sur 147 250 € (vérifié module par module)', () => {
    const r = calculerProjet(avecNegociation(0.05));
    expect(() => ResultatsSchema.parse(r)).not.toThrow();
    expect(r.achat).toEqual({
      prixAffiche: 155_000,
      prixRetenu: 147_250,
      negociationTaux: 0.05,
      negociationMontant: 7_750,
    });
    // Frais d'acquisition sur le prix négocié, honoraires (7 000 €) inchangés.
    const frais = r.financement.fraisAcquisition;
    expect(frais.base).toBe(140_250);
    expect(frais.total).toBeLessThan(reference.financement.fraisAcquisition.total);
    // Emprunt = prix retenu + travaux + frais + dossier + garantie − apport.
    expect(r.financement.montantEmprunte).toBeCloseTo(
      147_250 + 6_000 + frais.total + 850 + 1_500 - 14_337,
      6,
    );
    expect(r.financement.coutTotalProjet).toBeCloseTo(
      147_250 + 6_000 + frais.total + 850 + 1_500 + 5_000,
      6,
    );
    // Provision d'entretien : 0,5 % du prix retenu.
    expect(r.cashflow.charges.find((c) => c.code === 'entretien')?.annuel).toBeCloseTo(736.25, 6);
    // Rendements sur le coût complet.
    expect(r.rendement.rendements.coutTotal).toBeCloseTo(147_250 + 6_000 + frais.total, 6);
    // Revente et plus-value depuis le prix retenu.
    expect(r.revente.valeur).toBeCloseTo(147_250 * 1.015 ** 10, 6);
    expect(r.revente.plusValue.prixAcquisitionMajore).toBeGreaterThanOrEqual(147_250);
    // Estimation (206 733 €) et feu prix comparés au prix retenu.
    expect(r.estimation?.ecartPrix).toBeCloseTo(147_250 / 206_733 - 1, 3);
    expect(r.verdict.feux[0]?.valeur).toBeCloseTo(147_250 / 65 / 3181 - 1, 6);
    // Payer moins cher améliore le cash-flow et le TRI ; les scénarios restent complets.
    expect(r.cashflow.mensuel).toBeGreaterThan(reference.cashflow.mensuel);
    expect(r.rendement.tri ?? 0).toBeGreaterThan(reference.rendement.tri ?? 0);
    expect(r.scenarios?.scenarios).toHaveLength(6);
    expect(r.scenarios?.prixCibles).toHaveLength(3);
  });
});
