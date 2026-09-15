import {
  ReventeSchema,
  VERSION_REGLES_COURANTE,
  calculerProjet,
  obtenirRegles,
  projetExemple,
  type Regles,
} from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import {
  HORIZONS,
  HORIZON_MAX,
  HORIZON_MIN,
  impositionPlusValue,
  projetAHorizon,
  seuilsExoneration,
  variantesRevente,
} from '@/analyses';
import { sansPrixVente } from '@/analyses/revente';
import { descripteurParChemin } from '@/hypotheses';

const regles = obtenirRegles(VERSION_REGLES_COURANTE);

describe('bornes de l’horizon', () => {
  it('sont celles du schéma du moteur : 1 à 30 ans, jamais zéro', () => {
    expect(HORIZON_MIN).toBe(1);
    expect(HORIZON_MAX).toBe(30);
    expect(ReventeSchema.safeParse({ annees: HORIZON_MIN }).success).toBe(true);
    expect(ReventeSchema.safeParse({ annees: HORIZON_MAX }).success).toBe(true);
    expect(ReventeSchema.safeParse({ annees: HORIZON_MIN - 1 }).success).toBe(false);
    expect(ReventeSchema.safeParse({ annees: HORIZON_MAX + 1 }).success).toBe(false);
  });
});

describe('projetAHorizon', () => {
  it('change seulement la durée de détention, sans toucher à l’entrée', () => {
    const variante = projetAHorizon(projetExemple, 17);
    expect(variante.hypotheses.revente?.annees).toBe(17);
    expect(variante.hypotheses.revente?.evolutionAnnuelle).toBe(
      projetExemple.hypotheses.revente?.evolutionAnnuelle,
    );
    expect(variante.hypotheses.achat).toBe(projetExemple.hypotheses.achat);
    expect(variante.bien).toBe(projetExemple.bien);
    expect(projetExemple.hypotheses.revente?.annees).toBe(10);
    expect(calculerProjet(variante).revente!.annees).toBe(17);
  });
});

describe('sansPrixVente', () => {
  it('retire le prix de vente saisi et garde les autres hypothèses de revente', () => {
    const saisi = {
      ...projetExemple,
      hypotheses: {
        ...projetExemple.hypotheses,
        revente: { ...projetExemple.hypotheses.revente, prixVente: 200_000 },
      },
    };
    const estime = sansPrixVente(saisi);
    expect(estime.hypotheses.revente).not.toHaveProperty('prixVente');
    expect(estime.hypotheses.revente).toEqual(projetExemple.hypotheses.revente);
    expect(saisi.hypotheses.revente.prixVente).toBe(200_000);
  });

  it('accepte un projet sans hypothèses de revente', () => {
    const hypotheses = Object.fromEntries(
      Object.entries(projetExemple.hypotheses).filter(([k]) => k !== 'revente'),
    ) as typeof projetExemple.hypotheses;
    const projet = { ...projetExemple, hypotheses };
    expect(sansPrixVente(projet).hypotheses.revente).toEqual({});
  });
});

describe('variantesRevente', () => {
  it('projette le même bien à 5, 10, 15 et 20 ans', () => {
    const v = variantesRevente(projetExemple);
    expect(v.map((x) => x.annees)).toEqual([...HORIZONS]);
    expect(v[1]?.cashNetVendeur).toBeCloseTo(
      calculerProjet(projetExemple).revente!.cashNetVendeur,
      6,
    );
    expect(v[3]!.valeur).toBeGreaterThan(v[0]!.valeur);
    expect(v[3]!.cashNetVendeur).toBeGreaterThan(v[0]!.cashNetVendeur);
    for (const x of v) {
      expect(x.tri).not.toBeNull();
      expect(Number.isFinite(x.enrichissement)).toBe(true);
      expect(x.impotPlusValue).toBeGreaterThanOrEqual(0);
    }
  });

  it('accepte des horizons sur mesure', () => {
    const v = variantesRevente(projetExemple, [3, 25]);
    expect(v.map((x) => x.annees)).toEqual([3, 25]);
  });

  it('ne rend rien pour un projet sans loyer : aucune revente calculable', () => {
    const location = Object.fromEntries(
      Object.entries(projetExemple.hypotheses.location).filter(([k]) => k !== 'loyerHc'),
    );
    const sansLoyer = {
      ...projetExemple,
      hypotheses: { ...projetExemple.hypotheses, location },
    } as typeof projetExemple;
    expect(variantesRevente(sansLoyer)).toEqual([]);
  });
});

describe('impositionPlusValue', () => {
  // Valeurs de la feuille « NEW - Revente » de l'Excel de Pierre (règles 2026-09).
  it('vaut 36,2 % avant la 6ᵉ année, puis décroît avec les abattements', () => {
    const a5 = impositionPlusValue(5, regles);
    expect(a5).toEqual({ annees: 5, abattementIr: 0, abattementPs: 0, tauxGlobal: 0.362 });
    const a6 = impositionPlusValue(6, regles);
    expect(a6.abattementIr).toBeCloseTo(0.06, 10);
    expect(a6.abattementPs).toBeCloseTo(0.0165, 10);
    expect(a6.tauxGlobal).toBeCloseTo(0.347762, 6);
    const a10 = impositionPlusValue(10, regles);
    expect(a10.abattementIr).toBeCloseTo(0.3, 10);
    expect(a10.abattementPs).toBeCloseTo(0.0825, 10);
    expect(a10.tauxGlobal).toBeCloseTo(0.29081, 5);
  });

  it('ne garde que les prélèvements sociaux à 22 ans et plus rien à 30 ans', () => {
    const a22 = impositionPlusValue(22, regles);
    expect(a22.abattementIr).toBe(1);
    expect(a22.abattementPs).toBeCloseTo(0.28, 10);
    expect(a22.tauxGlobal).toBeCloseTo(0.12384, 5);
    const a30 = impositionPlusValue(30, regles);
    expect(a30.abattementIr).toBe(1);
    expect(a30.abattementPs).toBe(1);
    expect(a30.tauxGlobal).toBe(0);
  });

  it('suit les taux des règles plutôt que des constantes', () => {
    const autres: Regles = {
      ...regles,
      fiscalite: {
        ...regles.fiscalite,
        prelevementsSociaux: { ...regles.fiscalite.prelevementsSociaux, plusValue: 0.1 },
        plusValue: { ...regles.fiscalite.plusValue, tauxIr: 0.2 },
      },
    };
    expect(impositionPlusValue(3, autres).tauxGlobal).toBeCloseTo(0.3, 10);
  });
});

describe('seuilsExoneration', () => {
  it('trouve dans les règles la fin de l’impôt sur le revenu (22 ans) et des prélèvements sociaux (30 ans)', () => {
    expect(seuilsExoneration(regles, HORIZON_MAX)).toEqual({ ir: 22, ps: 30 });
  });

  it('rend null quand la borne est atteinte avant l’exonération, ou sans abattement', () => {
    expect(seuilsExoneration(regles, 25)).toEqual({ ir: 22, ps: null });
    const sansAbattement: Regles = {
      ...regles,
      fiscalite: {
        ...regles.fiscalite,
        plusValue: { ...regles.fiscalite.plusValue, abattementIr: [], abattementPs: [] },
      },
    };
    expect(seuilsExoneration(sansAbattement, HORIZON_MAX)).toEqual({ ir: null, ps: null });
  });
});

describe('descripteurParChemin', () => {
  it('retrouve un champ éditable et refuse un chemin inconnu', () => {
    expect(descripteurParChemin('hypotheses.revente.annees').libelle).toBe('Revente dans');
    expect(() => descripteurParChemin('hypotheses.inconnu')).toThrow(/Aucun descripteur/);
  });
});
