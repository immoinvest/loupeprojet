import { describe, expect, it } from 'vitest';

import {
  effetCharges,
  estimerPrix,
  prixSelonPosition,
  tauxDpe,
  tauxEtage,
  tauxExterieur,
} from '../../src/estimation';
import { projetExemple } from '../../src/exemples/t3-marseille';
import { obtenirRegles } from '../../src/regles';
import {
  DvfSchema,
  ProjetSchema,
  type Bien,
  type Projet,
  type ProjetEntree,
} from '../../src/schema';

const regles = obtenirRegles('2026-09');

/** Le T3 d'exemple avec des modifications : bien, marché et charges fusionnés. */
function projet(
  bien: Partial<ProjetEntree['bien']> = {},
  autres: Partial<ProjetEntree> = {},
): Projet {
  return ProjetSchema.parse({
    ...projetExemple,
    ...autres,
    bien: { ...projetExemple.bien, ...bien },
  });
}

const DVF = DvfSchema.parse({ medianM2: 3050, q1M2: 2700, q3M2: 3400, nombreVentes: 31 });
const bien = (b: Partial<Bien>): Bien => ({ ...projet().bien, ...b });

describe('prixSelonPosition', () => {
  it('interpole entre premier quartile, médiane et troisième quartile', () => {
    expect(prixSelonPosition(DVF, 0.25)).toBe(2700);
    expect(prixSelonPosition(DVF, 0.375)).toBe(2875);
    expect(prixSelonPosition(DVF, 0.5)).toBe(3050);
    expect(prixSelonPosition(DVF, 0.75)).toBe(3400);
  });

  it('sans quartiles, la médiane partout', () => {
    const median = DvfSchema.parse({ medianM2: 3050, nombreVentes: 3 });
    expect(prixSelonPosition(median, 0.25)).toBe(3050);
    expect(prixSelonPosition(median, 0.75)).toBe(3050);
  });
});

describe('corrections unitaires', () => {
  it('DPE : écart à la classe D selon le type ; inconnu ou non publié → aucune correction', () => {
    expect(tauxDpe(bien({ dpe: undefined }), regles)).toBeNull();
    expect(tauxDpe(bien({ dpe: 'E' }), regles)).toBe(-0.04);
    expect(tauxDpe(bien({ dpe: 'A' }), regles)).toBe(0.16);
    expect(tauxDpe(bien({ type: 'maison', dpe: 'C' }), regles)).toBeNull();
    expect(tauxDpe(bien({ type: 'maison', dpe: 'G' }), regles)).toBe(-0.25);
  });

  it('étage : rez-de-chaussée décoté, étages hauts selon l’ascenseur, rien pour une maison', () => {
    expect(tauxEtage(bien({ type: 'maison', etage: 0 }), regles)).toBeNull();
    expect(tauxEtage(bien({ etage: undefined }), regles)).toBeNull();
    expect(tauxEtage(bien({ etage: 0, ascenseur: true }), regles)).toBe(-0.099);
    expect(tauxEtage(bien({ etage: 0, ascenseur: undefined }), regles)).toBe(-0.096);
    expect(tauxEtage(bien({ etage: -1, ascenseur: false }), regles)).toBe(-0.096);
    expect(tauxEtage(bien({ etage: 5, ascenseur: undefined }), regles)).toBeNull();
    expect(tauxEtage(bien({ etage: 5, ascenseur: true }), regles)).toBe(0.04);
    expect(tauxEtage(bien({ etage: 3, ascenseur: true }), regles)).toBeNull();
    expect(tauxEtage(bien({ etage: 3, ascenseur: false }), regles)).toBe(-0.009);
    expect(tauxEtage(bien({ etage: 2, ascenseur: false }), regles)).toBeNull();
  });

  it('extérieur : prime seulement quand il existe', () => {
    expect(tauxExterieur(bien({ exterieur: true }), regles)).toBe(0.088);
    expect(tauxExterieur(bien({ exterieur: false }), regles)).toBeNull();
    expect(tauxExterieur(bien({}), regles)).toBeNull();
  });
});

describe('effetCharges', () => {
  it('capitalise l’écart au repère au rendement brut local (loyer ANIL ÷ médiane)', () => {
    const effet = effetCharges(projet(), DVF, regles, 200_000);
    const rendement = (15.1 * 12) / 3050;
    expect(effet).toMatchObject({ repereAnnuel: 1690, excedentAnnuel: -610, borneAtteinte: false });
    expect(effet?.rendementLocal).toBeCloseTo(rendement, 10);
    expect(effet?.montant).toBeCloseTo(610 / rendement, 6);
  });

  it('sans loyer de référence : loyer du projet ÷ prix ; loyer nul : rien', () => {
    const sansAnil = projet({}, { marche: { dvf: DVF } });
    expect(effetCharges(sansAnil, DVF, regles, 200_000)?.montant).toBeCloseTo(
      610 / ((980 * 12) / 155_000),
      6,
    );
    const sansLoyer = projet(
      {},
      {
        marche: { dvf: DVF },
        hypotheses: {
          ...projetExemple.hypotheses,
          location: { ...projetExemple.hypotheses.location, loyerHc: 0 },
        },
      },
    );
    expect(effetCharges(sansLoyer, DVF, regles, 200_000)).toBeNull();
  });

  it('charges très élevées : effet borné à 15 % ; charges nulles ou estimées : rien', () => {
    const cheres = projet(
      {},
      {
        hypotheses: {
          ...projetExemple.hypotheses,
          charges: { ...projetExemple.hypotheses.charges, coproAnnuel: 12_000 },
        },
      },
    );
    expect(effetCharges(cheres, DVF, regles, 200_000)).toMatchObject({
      montant: -30_000,
      borneAtteinte: true,
    });
    const nulles = projet(
      {},
      {
        hypotheses: {
          ...projetExemple.hypotheses,
          charges: { ...projetExemple.hypotheses.charges, coproAnnuel: 0 },
        },
      },
    );
    expect(effetCharges(nulles, DVF, regles, 200_000)).toBeNull();
    const estimees = projet(
      {},
      { provenance: { ...projetExemple.provenance, 'charges.coproAnnuel': 'estime' } },
    );
    expect(effetCharges(estimees, DVF, regles, 200_000)).toBeNull();
  });
});

describe('estimerPrix — T3 Marseille', () => {
  it('bon état supposé, 3e étage sans ascenseur, charges sous le repère, confiance moyenne', () => {
    const e = estimerPrix(projet(), regles);
    // Marché 3 050 €/m² × 65 m² = 198 250 € ; étage −0,9 % ; charges 610 €/an sous le repère
    // capitalisées à 181,2 ÷ 3 050 = 5,94 % → +10 267,66 €. Confiance : quartier à 500 m (12),
    // 31 ventes (20), dispersion 23 % (19), ancienneté supposée 12 mois (11) = 62, moyenne, ±8 %.
    expect(e).toEqual({
      etat: 'bon_etat',
      etatSuppose: true,
      prixM2Marche: 3050,
      corrections: [
        { code: 'etage', taux: -0.009, montant: -1784, ignoree: false },
        { code: 'charges', taux: 0.0518, montant: 10268, ignoree: false },
      ],
      prixM2Estime: 3181,
      centre: 206_733,
      bas: 190_195,
      haut: 223_272,
      selonEtat: { a_renover: 184_188, a_rafraichir: 195_461, bon_etat: 206_733, renove: 229_279 },
      confiance: {
        note: 62,
        niveau: 'moyenne',
        precision: 'quartier',
        composantes: [
          { code: 'localisation', valeur: 500, points: 12, maximum: 35, supposee: false },
          { code: 'comparables', valeur: 31, points: 20, maximum: 20, supposee: false },
          { code: 'dispersion', valeur: 0.2295, points: 19, maximum: 30, supposee: false },
          { code: 'anciennete', valeur: 12, points: 11, maximum: 15, supposee: true },
        ],
      },
      marge: 0.08,
      charges: {
        repereAnnuel: 1690,
        excedentAnnuel: -610,
        rendementLocal: 0.0594,
        borneAtteinte: false,
      },
      actualiseAu: null,
      ecartPrix: -0.2502,
    });
  });

  it('état, DPE, extérieur ; corrections ignorées listées sans effet ; semestre d’actualisation', () => {
    const e = estimerPrix(
      projet(
        { etat: 'renove', dpe: 'B', exterieur: true, etage: 1 },
        {
          marche: {
            ...projetExemple.marche,
            dvf: {
              ...projetExemple.marche?.dvf,
              medianM2: 3050,
              nombreVentes: 12,
              rayonMetres: 150,
              actualiseAu: '2025-S1',
            },
          },
          estimation: { correctionsIgnorees: ['exterieur', 'charges'] },
        },
      ),
      regles,
    );
    expect(e?.etatSuppose).toBe(false);
    expect(e?.prixM2Marche).toBe(3400);
    expect(e?.corrections).toEqual([
      { code: 'dpe', taux: 0.12, montant: 26_520, ignoree: false },
      { code: 'exterieur', taux: 0.088, montant: 19_448, ignoree: true },
      { code: 'charges', taux: 0.0465, montant: 10_268, ignoree: true },
    ]);
    // 3 400 × 65 × 1,12 = 247 520 € ; confiance : quartier à 150 m (22), 12 ventes (13),
    // dispersion 23 % (19), ancienneté supposée (11) = 65, bonne, ±6,5 %.
    expect(e).toMatchObject({
      centre: 247_520,
      bas: 231_431,
      haut: 263_609,
      confiance: { note: 65, niveau: 'bonne', precision: 'quartier' },
      marge: 0.065,
      actualiseAu: '2025-S1',
    });
    expect(e?.selonEtat.a_renover).toBe(196_560);
  });

  it('sans ventes connues : pas d’estimation', () => {
    expect(estimerPrix(projet({}, { marche: {} }), regles)).toBeNull();
  });
});
