import { describe, expect, it } from 'vitest';

import {
  effetCharges,
  estimerPrix,
  niveauConfiance,
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

  it('confiance : élevée à 10 ventes dans 300 m, moyenne à 5 ventes dans 1 km, faible sinon', () => {
    const dvf = (nombreVentes: number, rayonMetres?: number): ReturnType<typeof DvfSchema.parse> =>
      DvfSchema.parse({ medianM2: 3000, nombreVentes, rayonMetres });
    expect(niveauConfiance(dvf(12, 250), regles)).toBe('elevee');
    expect(niveauConfiance(dvf(12, 800), regles)).toBe('moyenne');
    expect(niveauConfiance(dvf(5, 1000), regles)).toBe('moyenne');
    expect(niveauConfiance(dvf(4, 100), regles)).toBe('faible');
    expect(niveauConfiance(dvf(500), regles)).toBe('faible');
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
    // Loyer visé absent (rapport partiel) et pas de loyer de référence : aucun rendement local.
    const location = Object.fromEntries(
      Object.entries(projetExemple.hypotheses.location).filter(([k]) => k !== 'loyerHc'),
    ) as ProjetEntree['hypotheses']['location'];
    const loyerInconnu = projet(
      {},
      { marche: { dvf: DVF }, hypotheses: { ...projetExemple.hypotheses, location } },
    );
    expect(loyerInconnu.hypotheses.location.loyerHc).toBeUndefined();
    expect(effetCharges(loyerInconnu, DVF, regles, 200_000)).toBeNull();
    // Avec le loyer de référence ANIL, le loyer visé n'est pas nécessaire.
    const anilSeul = projet({}, { hypotheses: { ...projetExemple.hypotheses, location } });
    expect(effetCharges(anilSeul, DVF, regles, 200_000)?.montant).toBeCloseTo(
      610 / ((15.1 * 12) / 3050),
      6,
    );
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
    // capitalisées à 181,2 ÷ 3 050 = 5,94 % → +10 267,66 €.
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
      confiance: 'moyenne',
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
    // 3 400 × 65 × 1,12 = 247 520 € ; confiance élevée ±5 %.
    expect(e).toMatchObject({
      centre: 247_520,
      bas: 235_144,
      haut: 259_896,
      confiance: 'elevee',
      actualiseAu: '2025-S1',
    });
    expect(e?.selonEtat.a_renover).toBe(196_560);
  });

  it('sans ventes connues : pas d’estimation', () => {
    expect(estimerPrix(projet({}, { marche: {} }), regles)).toBeNull();
  });
});
