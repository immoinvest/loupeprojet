import { describe, expect, it } from 'vitest';

import { calculerBase } from '../../src/calculer-base';
import { calculerProjet } from '../../src/calculer-projet';
import { projetExemple } from '../../src/exemples/t3-marseille';
import { obtenirRegles } from '../../src/regles';
import { ProjetSchema, type ProjetEntree } from '../../src/schema';
import { ResultatsCompletsSchema, ResultatsSchema } from '../../src/schema/resultats';

const regles = obtenirRegles('2026-09');

/** Copie d'un objet sans l'une de ses clés. */
function sansCle<T extends object, K extends keyof T>(objet: T, cle: K): Omit<T, K> {
  return Object.fromEntries(Object.entries(objet).filter(([k]) => k !== cle)) as Omit<T, K>;
}

/** Le T3 d'exemple sans loyer visé. */
function sansLoyer(): ProjetEntree {
  return {
    ...projetExemple,
    hypotheses: {
      ...projetExemple.hypotheses,
      location: sansCle(projetExemple.hypotheses.location, 'loyerHc'),
    },
  };
}

describe('calculerProjet — projet sans loyer', () => {
  const complet = calculerProjet(projetExemple);
  const partiel = calculerProjet(sansLoyer());

  it('ne lève pas et rend un rapport partiel que le schéma de sortie accepte', () => {
    expect(partiel.complet).toBe(false);
    expect(partiel.cashflow).toBeNull();
    expect(partiel.fiscalite).toBeNull();
    expect(partiel.revente).toBeNull();
    expect(partiel.rendement).toBeNull();
    expect(partiel.scenarios).toBeNull();
    expect(partiel.manques).toEqual([
      { code: 'LOYER_ABSENT', champ: 'hypotheses.location.loyerHc' },
    ]);
    expect(() => ResultatsSchema.parse(partiel)).not.toThrow();
    expect(ResultatsCompletsSchema.safeParse(partiel).success).toBe(false);
    expect(partiel.meta).toEqual(complet.meta);
  });

  it('calcule le financement et l’estimation comme pour le projet complet', () => {
    expect(partiel.financement.montantEmprunte).toBe(complet.financement.montantEmprunte);
    expect(partiel.financement.mensualiteTotale).toBe(complet.financement.mensualiteTotale);
    expect(partiel.financement.taegAvecAssurance).toBe(complet.financement.taegAvecAssurance);
    expect(partiel.financement.fraisAcquisition).toEqual(complet.financement.fraisAcquisition);
    // Le loyer de référence ANIL porte la correction charges : l'estimation ne change pas.
    expect(partiel.estimation).toEqual(complet.estimation);
  });

  it('effort : ni revenus ni loyer, aucune lecture et rien de signalé', () => {
    expect(partiel.financement.effort.hcsf).toBeNull();
    expect(partiel.financement.effort.sansLoyers).toBeNull();
    expect(partiel.financement.effort.depasseHcsf).toBe(false);
  });

  it('cinq feux : prix et risques comme avant, les trois autres inconnus avec la raison', () => {
    expect(partiel.verdict.feux[0]).toEqual(complet.verdict.feux[0]);
    expect(partiel.verdict.feux[4]).toEqual(complet.verdict.feux[4]);
    for (const axe of ['rendement', 'cashflow', 'couverture']) {
      expect(partiel.verdict.feux.find((f) => f.axe === axe)).toEqual({
        axe,
        feu: 'inconnu',
        valeur: null,
        raison: 'LOYER_ABSENT',
      });
    }
    expect(partiel.verdict.synthese).toEqual({ bons: 2, surveiller: 0, problemes: 0, inconnus: 3 });
  });

  it('points de vigilance : ceux de la banque seulement, rien qui dépende du loyer ou du régime', () => {
    // Les signaux du bien (copropriété, DPE, étage) vivent dans les questions de visite, qui ne
    // lisent que les feux : ils restent disponibles sans loyer.
    const codes = partiel.verdict.vigilance.map((p) => p.code);
    expect(codes).toEqual([]);
    expect(complet.verdict.vigilance.map((p) => p.code)).toContain('PS_BIC_A_CONFIRMER');
  });

  it('projet ancien avec des revenus, sans loyer : la lecture sans loyers reste, la couverture attend le loyer', () => {
    const entree = sansLoyer();
    const r = calculerProjet({
      ...entree,
      hypotheses: { ...entree.hypotheses, revenusMensuels: 2_600 },
    });
    expect(r.manques.map((m) => m.code)).toEqual(['LOYER_ABSENT']);
    expect(r.financement.effort.hcsf).toBeNull();
    expect(r.financement.effort.sansLoyers).toBeCloseTo(r.financement.mensualiteTotale / 2_600, 10);
    expect(r.verdict.feux[3]?.raison).toBe('LOYER_ABSENT');
    expect(() => ResultatsSchema.parse(r)).not.toThrow();
  });

  it('ne contient aucun NaN ni infini', () => {
    const chiffres: number[] = [];
    const visiter = (v: unknown): void => {
      if (typeof v === 'number') chiffres.push(v);
      else if (Array.isArray(v)) v.forEach(visiter);
      else if (v !== null && typeof v === 'object') Object.values(v).forEach(visiter);
    };
    visiter(partiel);
    expect(chiffres.length).toBeGreaterThan(100);
    expect(chiffres.every((c) => Number.isFinite(c))).toBe(true);
  });

  it('les scénarios ne sont pas calculés, même demandés', () => {
    expect(calculerProjet(sansLoyer(), { avecScenarios: true }).scenarios).toBeNull();
    expect(calculerProjet(sansLoyer(), { avecScenarios: false }).scenarios).toBeNull();
  });

  it('calculerBase choisit le calcul partiel ou complet selon le loyer', () => {
    expect(calculerBase(ProjetSchema.parse(sansLoyer()), regles).complet).toBe(false);
    expect(calculerBase(ProjetSchema.parse(projetExemple), regles).complet).toBe(true);
  });

  it('un rapport partiel sans ventes réelles : prix inconnu sans raison, estimation nulle', () => {
    const r = calculerProjet({ ...sansLoyer(), marche: {} });
    expect(r.estimation).toBeNull();
    expect(r.verdict.feux[0]).toEqual({ axe: 'prix', feu: 'inconnu', valeur: null, raison: null });
    expect(r.verdict.synthese.inconnus).toBe(4);
  });
});
