import { describe, expect, it } from 'vitest';

import { projetExemple } from '../../src/exemples/t3-marseille';
import {
  CHAMP_LOYER,
  CHAMP_REVENUS,
  ManqueSchema,
  ProjetSchema,
  TMI_PAR_DEFAUT,
  estComplet,
  manquesDe,
  parserComplet,
  raisonParmi,
  type ProjetEntree,
} from '../../src/schema';

/** Copie d'un objet sans l'une de ses clés (une hypothèse absente de l'entrée). */
function sansCle<T extends object, K extends keyof T>(objet: T, cle: K): Omit<T, K> {
  return Object.fromEntries(Object.entries(objet).filter(([k]) => k !== cle)) as Omit<T, K>;
}

const avecHypotheses = (hypotheses: object): ProjetEntree =>
  ({ ...projetExemple, hypotheses }) as ProjetEntree;

describe('défauts et absences du schéma', () => {
  it('pose la tranche à 30 % quand elle manque, refuse toujours une tranche hors barème', () => {
    const fiscalite = sansCle(projetExemple.hypotheses.fiscalite, 'tmi');
    const projet = ProjetSchema.parse(avecHypotheses({ ...projetExemple.hypotheses, fiscalite }));
    expect(projet.hypotheses.fiscalite.tmi).toBe(TMI_PAR_DEFAUT);
    expect(TMI_PAR_DEFAUT).toBe(0.3);
    expect(
      ProjetSchema.safeParse(
        avecHypotheses({ ...projetExemple.hypotheses, fiscalite: { ...fiscalite, tmi: 0.25 } }),
      ).success,
    ).toBe(false);
  });

  it('accepte un projet sans revenus', () => {
    const sansRevenus = sansCle(projetExemple.hypotheses, 'revenusMensuels');
    const projet = ProjetSchema.parse(avecHypotheses(sansRevenus));
    expect(projet.hypotheses.revenusMensuels).toBeUndefined();
    expect(
      ProjetSchema.safeParse(avecHypotheses({ ...sansRevenus, revenusMensuels: -1 })).success,
    ).toBe(false);
  });
});

describe('manquesDe', () => {
  it('rien ne manque au projet d’exemple', () => {
    expect(manquesDe(ProjetSchema.parse(projetExemple))).toEqual([]);
  });

  it('signale les revenus absents avec le chemin du champ', () => {
    const manques = manquesDe(
      ProjetSchema.parse(avecHypotheses(sansCle(projetExemple.hypotheses, 'revenusMensuels'))),
    );
    expect(manques).toEqual([{ code: 'REVENUS_ABSENTS', champ: CHAMP_REVENUS }]);
    expect(CHAMP_REVENUS).toBe('hypotheses.revenusMensuels');
    expect(CHAMP_LOYER).toBe('hypotheses.location.loyerHc');
    for (const m of manques) expect(() => ManqueSchema.parse(m)).not.toThrow();
  });

  it('signale le loyer avant les revenus ; estComplet et parserComplet le savent', () => {
    const location = sansCle(projetExemple.hypotheses.location, 'loyerHc');
    const entree = avecHypotheses(
      sansCle({ ...projetExemple.hypotheses, location }, 'revenusMensuels'),
    );
    const projet = ProjetSchema.parse(entree);
    expect(projet.hypotheses.location.loyerHc).toBeUndefined();
    expect(estComplet(projet)).toBe(false);
    expect(manquesDe(projet)).toEqual([
      { code: 'LOYER_ABSENT', champ: CHAMP_LOYER },
      { code: 'REVENUS_ABSENTS', champ: CHAMP_REVENUS },
    ]);
    expect(() => parserComplet(entree)).toThrow(/loyer visé manque/);
    const complet = parserComplet(projetExemple);
    expect(estComplet(complet)).toBe(true);
    expect(complet.hypotheses.location.loyerHc).toBe(980);
  });

  it('courte durée sans loyer : accepté par le schéma, mais le projet reste incomplet', () => {
    const projet = ProjetSchema.parse(
      avecHypotheses({
        ...projetExemple.hypotheses,
        location: { mode: 'courte_duree', courteDuree: { nuitee: 75, tauxOccupation: 0.6 } },
      }),
    );
    expect(projet.hypotheses.location.courteDuree?.nuitee).toBe(75);
    expect(estComplet(projet)).toBe(false);
    expect(manquesDe(projet).map((m) => m.code)).toEqual(['LOYER_ABSENT']);
  });

  it('raisonParmi rend le premier manque parmi les codes cherchés, sinon null', () => {
    const manques = [{ code: 'REVENUS_ABSENTS' as const, champ: CHAMP_REVENUS }];
    expect(raisonParmi(manques, ['LOYER_ABSENT', 'REVENUS_ABSENTS'])).toBe('REVENUS_ABSENTS');
    expect(raisonParmi(manques, ['LOYER_ABSENT'])).toBeNull();
    expect(raisonParmi([], ['REVENUS_ABSENTS'])).toBeNull();
  });
});
