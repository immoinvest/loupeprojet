import { describe, expect, it } from 'vitest';

import { projetExemple } from '../../src/exemples/t3-marseille';
import { ProjetSchema, type ProjetEntree } from '../../src/schema';

const avecPret = (pret: Partial<ProjetEntree['hypotheses']['pret']>): ProjetEntree => ({
  ...projetExemple,
  hypotheses: { ...projetExemple.hypotheses, pret: { ...projetExemple.hypotheses.pret, ...pret } },
});

describe('ProjetSchema', () => {
  it('accepte le projet d’exemple et applique les défauts', () => {
    const projet = ProjetSchema.parse(projetExemple);
    expect(projet.hypotheses.location.vacanceSemaines).toBe(3);
    expect(projet.hypotheses.charges.entretienTaux).toBe(0.005);
    expect(projet.hypotheses.fiscalite.psBic).toBe(0.186);
    expect(projet.hypotheses.fiscalite.psFoncier).toBe(0.172);
    expect(projet.hypotheses.revente.diagnostics).toBe(500);
    expect(projet.hypotheses.pret.differeTotalMois).toBe(0);
    expect(projet.bien.copro?.procedure).toBe(false);
  });

  it('remplit marche, charges, revente et provenance quand ils manquent', () => {
    const { achat, pret, location, fiscalite } = projetExemple.hypotheses;
    const projet = ProjetSchema.parse({
      id: projetExemple.id,
      versionRegles: projetExemple.versionRegles,
      bien: projetExemple.bien,
      hypotheses: { achat, pret, location, fiscalite },
    });
    expect(projet.hypotheses.revenusMensuels).toBeUndefined();
    expect(projet.marche.risques).toEqual([]);
    expect(projet.marche.dvf).toBeUndefined();
    expect(projet.hypotheses.charges.taxeFonciere).toBe(0);
    expect(projet.hypotheses.revente.annees).toBe(10);
    expect(projet.provenance).toEqual({});
  });

  it('refuse un prix négatif en nommant le champ', () => {
    const resultat = ProjetSchema.safeParse({
      ...projetExemple,
      hypotheses: {
        ...projetExemple.hypotheses,
        achat: { ...projetExemple.hypotheses.achat, prix: -1 },
      },
    });
    expect(resultat.success).toBe(false);
    expect(resultat.error?.issues[0]?.path).toEqual(['hypotheses', 'achat', 'prix']);
  });

  it('refuse une durée de prêt de 0 an', () => {
    const resultat = ProjetSchema.safeParse(avecPret({ dureeAnnees: 0 }));
    expect(resultat.success).toBe(false);
    expect(resultat.error?.issues[0]?.path).toEqual(['hypotheses', 'pret', 'dureeAnnees']);
  });

  it('refuse un différé aussi long que le prêt', () => {
    const resultat = ProjetSchema.safeParse(
      avecPret({ dureeAnnees: 2, differeTotalMois: 12, differePartielMois: 12 }),
    );
    expect(resultat.success).toBe(false);
    expect(resultat.error?.issues[0]?.path).toEqual(['hypotheses', 'pret', 'differeTotalMois']);
  });

  it('accepte un différé plus court que le prêt', () => {
    const projet = ProjetSchema.parse(avecPret({ differeTotalMois: 12, differePartielMois: 6 }));
    expect(projet.hypotheses.pret.differePartielMois).toBe(6);
  });

  it('exige les hypothèses de courte durée en mode courte durée', () => {
    const resultat = ProjetSchema.safeParse({
      ...projetExemple,
      hypotheses: {
        ...projetExemple.hypotheses,
        location: { mode: 'courte_duree', loyerHc: 0 },
      },
    });
    expect(resultat.success).toBe(false);
    expect(resultat.error?.issues[0]?.path).toEqual(['hypotheses', 'location', 'courteDuree']);
  });

  it('accepte la courte durée complète', () => {
    const projet = ProjetSchema.parse({
      ...projetExemple,
      hypotheses: {
        ...projetExemple.hypotheses,
        location: {
          mode: 'courte_duree',
          loyerHc: 0,
          courteDuree: { nuitee: 75, tauxOccupation: 0.6 },
        },
      },
    });
    expect(projet.hypotheses.location.courteDuree?.fraisMenageParNuit).toBe(0);
  });

  it('refuse une TMI hors barème et un département mal formé', () => {
    expect(
      ProjetSchema.safeParse({
        ...projetExemple,
        hypotheses: {
          ...projetExemple.hypotheses,
          fiscalite: { ...projetExemple.hypotheses.fiscalite, tmi: 0.25 },
        },
      }).success,
    ).toBe(false);
    expect(
      ProjetSchema.safeParse({
        ...projetExemple,
        bien: { ...projetExemple.bien, departement: 'AB' },
      }).success,
    ).toBe(false);
    expect(
      ProjetSchema.safeParse({
        ...projetExemple,
        bien: { ...projetExemple.bien, departement: '2A' },
      }).success,
    ).toBe(true);
  });

  it('accepte une source d’annonce (portail, id, URL) et refuse une URL invalide', () => {
    const source = {
      portail: 'leboncoin',
      id: '2214738851',
      url: 'https://www.leboncoin.fr/ad/x/2214738851',
    };
    expect(ProjetSchema.parse({ ...projetExemple, source }).source).toEqual(source);
    expect(
      ProjetSchema.safeParse({ ...projetExemple, source: { ...source, url: 'pas une url' } })
        .success,
    ).toBe(false);
  });

  it('refuse une version de règles inconnue', () => {
    const resultat = ProjetSchema.safeParse({ ...projetExemple, versionRegles: '2031-01' });
    expect(resultat.success).toBe(false);
  });
});

describe('AchatSchema — négociation', () => {
  it('vaut 0 quand le champ manque (projets enregistrés avant la négociation)', () => {
    expect(ProjetSchema.parse(projetExemple).hypotheses.achat.negociationTaux).toBe(0);
  });

  it('refuse un taux négatif ou au-delà de 30 % en nommant le champ', () => {
    for (const negociationTaux of [-0.01, 0.31]) {
      const resultat = ProjetSchema.safeParse({
        ...projetExemple,
        hypotheses: {
          ...projetExemple.hypotheses,
          achat: { ...projetExemple.hypotheses.achat, negociationTaux },
        },
      });
      expect(resultat.success).toBe(false);
      expect(resultat.error?.issues[0]?.path).toEqual(['hypotheses', 'achat', 'negociationTaux']);
    }
  });
});
