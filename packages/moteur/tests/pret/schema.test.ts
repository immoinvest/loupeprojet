import { describe, expect, it } from 'vitest';

import { OffrePretSchema, ProjetFinanceSchema, SimulationPretSchema } from '../../src/pret/schema';

describe('OffrePretSchema', () => {
  it('complète une offre minimale avec les défauts', () => {
    const o = OffrePretSchema.parse({ tauxNominal: 0.033, dureeAnnees: 25 });
    expect(o).toEqual({
      nom: '',
      apport: 0,
      fraisDossier: 0,
      fraisGarantie: 0,
      fraisBancairesFinances: false,
      tauxNominal: 0.033,
      tauxAssurance: 0.0025,
      dureeAnnees: 25,
      differeTotalMois: 0,
      differePartielMois: 0,
    });
  });

  it('coupe les espaces du nom et refuse plus de 40 caractères', () => {
    expect(OffrePretSchema.parse({ nom: '  LCL ', tauxNominal: 0.03, dureeAnnees: 20 }).nom).toBe(
      'LCL',
    );
    expect(
      OffrePretSchema.safeParse({ nom: 'x'.repeat(41), tauxNominal: 0.03, dureeAnnees: 20 })
        .success,
    ).toBe(false);
  });

  it('borne le taux à 20 %, l’assurance à 2 %, la durée de 1 à 30 ans, les différés à 36 mois', () => {
    const base = { tauxNominal: 0.03, dureeAnnees: 20 };
    for (const mauvais of [
      { ...base, tauxNominal: 0.21 },
      { ...base, tauxNominal: -0.01 },
      { ...base, tauxAssurance: 0.021 },
      { ...base, dureeAnnees: 0 },
      { ...base, dureeAnnees: 31 },
      { ...base, dureeAnnees: 20.5 },
      { ...base, differeTotalMois: 37 },
      { ...base, differePartielMois: -1 },
      { ...base, apport: -1 },
      { ...base, fraisDossier: 100_000_001 },
    ]) {
      expect(OffrePretSchema.safeParse(mauvais).success, JSON.stringify(mauvais)).toBe(false);
    }
    expect(
      OffrePretSchema.safeParse({ ...base, tauxNominal: 0.2, tauxAssurance: 0.02 }).success,
    ).toBe(true);
  });

  it('refuse un différé aussi long que le prêt, sur differeTotalMois', () => {
    const resultat = OffrePretSchema.safeParse({
      tauxNominal: 0.03,
      dureeAnnees: 3,
      differeTotalMois: 36,
    });
    expect(resultat.success).toBe(false);
    if (!resultat.success) {
      expect(resultat.error.issues[0]?.path).toEqual(['differeTotalMois']);
      expect(resultat.error.issues[0]?.message).toBe('Le différé doit être plus court que le prêt');
    }
    expect(
      OffrePretSchema.safeParse({ tauxNominal: 0.03, dureeAnnees: 3, differeTotalMois: 35 })
        .success,
    ).toBe(true);
    expect(
      OffrePretSchema.safeParse({
        tauxNominal: 0.03,
        dureeAnnees: 20,
        differeTotalMois: 36,
        differePartielMois: 36,
      }).success,
    ).toBe(true);
  });
});

describe('ProjetFinanceSchema', () => {
  it('exige un prix positif et des frais de notaire, le reste par défaut ou facultatif', () => {
    expect(ProjetFinanceSchema.parse({ prix: 150_000, fraisNotaire: 12_000 })).toEqual({
      prix: 150_000,
      honorairesAgence: 0,
      travaux: 0,
      fraisNotaire: 12_000,
    });
    expect(ProjetFinanceSchema.safeParse({ prix: 0, fraisNotaire: 0 }).success).toBe(false);
    expect(ProjetFinanceSchema.safeParse({ prix: 100_000_001, fraisNotaire: 0 }).success).toBe(
      false,
    );
    expect(ProjetFinanceSchema.safeParse({ prix: 150_000 }).success).toBe(false);
  });

  it('accepte un département de 2 ou 3 caractères et des revenus', () => {
    const p = ProjetFinanceSchema.parse({
      prix: 150_000,
      fraisNotaire: 12_000,
      departement: ' 13 ',
      revenusMensuels: 2_400,
    });
    expect(p.departement).toBe('13');
    expect(p.revenusMensuels).toBe(2_400);
    expect(
      ProjetFinanceSchema.safeParse({ prix: 150_000, fraisNotaire: 12_000, departement: '1' })
        .success,
    ).toBe(false);
    expect(
      ProjetFinanceSchema.safeParse({ prix: 150_000, fraisNotaire: 12_000, departement: '2A' })
        .success,
    ).toBe(true);
  });
});

describe('SimulationPretSchema', () => {
  const projet = { prix: 150_000, fraisNotaire: 12_000 };
  const offre = { tauxNominal: 0.033, dureeAnnees: 25 };

  it('accepte une ou deux offres et pose la version des règles', () => {
    const une = SimulationPretSchema.parse({ projet, offres: [offre] });
    expect(une.versionRegles).toBe('2026-09');
    expect(une.offres).toHaveLength(1);
    expect(SimulationPretSchema.parse({ projet, offres: [offre, offre] }).offres).toHaveLength(2);
  });

  it('refuse zéro ou trois offres et une version de règles inconnue', () => {
    expect(SimulationPretSchema.safeParse({ projet, offres: [] }).success).toBe(false);
    expect(SimulationPretSchema.safeParse({ projet, offres: [offre, offre, offre] }).success).toBe(
      false,
    );
    expect(
      SimulationPretSchema.safeParse({ versionRegles: '2030-01', projet, offres: [offre] }).success,
    ).toBe(false);
  });
});
