import { describe, expect, it } from 'vitest';

import { projetExemple } from '../../src/exemples/t3-marseille';
import {
  LocationSchema,
  MODES_LOCATION,
  ProjetSchema,
  regimesCompatibles,
  type ProjetEntree,
} from '../../src/schema';

const avecPret = (pret: Partial<ProjetEntree['hypotheses']['pret']>): ProjetEntree => ({
  ...projetExemple,
  hypotheses: { ...projetExemple.hypotheses, pret: { ...projetExemple.hypotheses.pret, ...pret } },
});

const avecLocation = (
  location: ProjetEntree['hypotheses']['location'],
  regime: ProjetEntree['hypotheses']['fiscalite']['regime'] = 'lmnp_reel',
): ProjetEntree => ({
  ...projetExemple,
  hypotheses: {
    ...projetExemple.hypotheses,
    location,
    fiscalite: { ...projetExemple.hypotheses.fiscalite, regime },
  },
});

describe('ProjetSchema', () => {
  it('accepte le projet d’exemple et applique les défauts', () => {
    const projet = ProjetSchema.parse(projetExemple);
    expect(projet.hypotheses.location).toMatchObject({ mode: 'meuble', vacanceSemaines: 3 });
    expect(projet.hypotheses.charges.entretienTaux).toBe(0.005);
    expect(projet.hypotheses.charges.energieMensuel).toBe(0);
    expect(projet.hypotheses.charges.internetMensuel).toBe(0);
    expect(projet.hypotheses.fiscalite.psBic).toBe(0.186);
    expect(projet.hypotheses.fiscalite.psFoncier).toBe(0.172);
    expect(projet.hypotheses.revente.diagnostics).toBe(500);
    expect(projet.hypotheses.pret.differeTotalMois).toBe(0);
    expect(projet.bien.copro?.procedure).toBe(false);
  });

  it('remplit marche, charges, revente et provenance quand ils manquent', () => {
    const { achat, pret, location, fiscalite, revenusMensuels } = projetExemple.hypotheses;
    const projet = ProjetSchema.parse({
      id: projetExemple.id,
      versionRegles: projetExemple.versionRegles,
      bien: projetExemple.bien,
      hypotheses: { achat, pret, location, fiscalite, revenusMensuels },
    });
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

describe('LocationSchema — cinq types d’exploitation', () => {
  it('liste les cinq modes', () => {
    expect(MODES_LOCATION).toEqual(['nu', 'meuble', 'colocation', 'courte_duree', 'moyenne_duree']);
  });

  it('complète chaque variante avec ses défauts', () => {
    expect(LocationSchema.parse({ mode: 'nu', loyerHc: 800 })).toEqual({
      mode: 'nu',
      loyerHc: 800,
      chargesLocataire: 0,
      vacanceSemaines: 3,
      gestionTaux: 0,
    });
    expect(LocationSchema.parse({ mode: 'colocation', chambres: 4, loyerChambre: 460 })).toEqual({
      mode: 'colocation',
      chambres: 4,
      loyerChambre: 460,
      forfaitChargesChambre: 0,
      vacanceSemaines: 4,
      gestionTaux: 0,
    });
    expect(LocationSchema.parse({ mode: 'courte_duree', nuitee: 75, nuiteesParMois: 15 })).toEqual({
      mode: 'courte_duree',
      nuitee: 75,
      nuiteesParMois: 15,
      dureeSejourNuits: 4,
      menageFactureParSejour: 0,
      menageCoutParSejour: 0,
      plateformeTaux: 0,
      conciergerieTaux: 0,
      tourismeClasse: false,
    });
    expect(LocationSchema.parse({ mode: 'moyenne_duree', loyerHc: 900 })).toEqual({
      mode: 'moyenne_duree',
      loyerHc: 900,
      forfaitCharges: 0,
      dureeSejourMois: 4,
      vacanceSemaines: 4,
      menageCoutParSejour: 0,
      plateformeTaux: 0,
      gestionTaux: 0,
    });
  });

  it('refuse un mode inconnu, l’ancien « meuble_lld » et une variante incomplète', () => {
    expect(LocationSchema.safeParse({ mode: 'meuble_lld', loyerHc: 980 }).success).toBe(false);
    expect(LocationSchema.safeParse({ mode: 'saisonnier', loyerHc: 980 }).success).toBe(false);
    expect(LocationSchema.safeParse({ mode: 'courte_duree', nuitee: 75 }).success).toBe(false);
    expect(LocationSchema.safeParse({ mode: 'colocation', loyerChambre: 460 }).success).toBe(false);
    expect(
      LocationSchema.safeParse({ mode: 'courte_duree', nuitee: 75, nuiteesParMois: 40 }).success,
    ).toBe(false);
  });

  it('ignore les champs d’une autre variante (une nuitée sur une location nue)', () => {
    const nu = LocationSchema.parse({ mode: 'nu', loyerHc: 800, nuitee: 90 });
    expect(nu).not.toHaveProperty('nuitee');
  });
});

describe('HypothesesSchema — régime compatible avec le type', () => {
  it('nue et meublée acceptent les quatre régimes', () => {
    expect(regimesCompatibles('nu')).toEqual([
      'micro_bic',
      'lmnp_reel',
      'micro_foncier',
      'nu_reel',
    ]);
    expect(
      ProjetSchema.safeParse(avecLocation({ mode: 'nu', loyerHc: 800 }, 'micro_bic')).success,
    ).toBe(true);
    expect(
      ProjetSchema.safeParse(avecLocation({ mode: 'meuble', loyerHc: 980 }, 'nu_reel')).success,
    ).toBe(true);
  });

  it('colocation, courte et moyenne durée refusent un régime foncier en nommant le champ', () => {
    expect(regimesCompatibles('colocation')).toEqual(['micro_bic', 'lmnp_reel']);
    expect(regimesCompatibles('courte_duree')).toEqual(['micro_bic', 'lmnp_reel']);
    expect(regimesCompatibles('moyenne_duree')).toEqual(['micro_bic', 'lmnp_reel']);
    const refus = ProjetSchema.safeParse(
      avecLocation({ mode: 'colocation', chambres: 3, loyerChambre: 450 }, 'micro_foncier'),
    );
    expect(refus.success).toBe(false);
    expect(refus.error?.issues[0]?.path).toEqual(['hypotheses', 'fiscalite', 'regime']);
    expect(
      ProjetSchema.safeParse(avecLocation({ mode: 'moyenne_duree', loyerHc: 900 }, 'micro_bic'))
        .success,
    ).toBe(true);
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
