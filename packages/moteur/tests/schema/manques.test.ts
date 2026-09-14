import { describe, expect, it } from 'vitest';

import { projetExemple } from '../../src/exemples/t3-marseille';
import {
  CHAMP_LOYER,
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

  it('les revenus d’un projet ancien restent lisibles, jamais négatifs', () => {
    expect(projetExemple.hypotheses).not.toHaveProperty('revenusMensuels');
    const ancien = ProjetSchema.parse(
      avecHypotheses({ ...projetExemple.hypotheses, revenusMensuels: 2_600 }),
    );
    expect(ancien.hypotheses.revenusMensuels).toBe(2_600);
    expect(
      ProjetSchema.safeParse(avecHypotheses({ ...projetExemple.hypotheses, revenusMensuels: -1 }))
        .success,
    ).toBe(false);
  });
});

describe('manquesDe', () => {
  it('rien ne manque au projet d’exemple, même sans revenus : Deklic ne les demande pas', () => {
    expect(manquesDe(ProjetSchema.parse(projetExemple))).toEqual([]);
  });

  it('signale le loyer avec le chemin du champ ; estComplet et parserComplet le savent', () => {
    const location = sansCle(projetExemple.hypotheses.location, 'loyerHc');
    const entree = avecHypotheses({ ...projetExemple.hypotheses, location });
    const projet = ProjetSchema.parse(entree);
    expect(projet.hypotheses.location.loyerHc).toBeUndefined();
    expect(estComplet(projet)).toBe(false);
    const manques = manquesDe(projet);
    expect(manques).toEqual([{ code: 'LOYER_ABSENT', champ: CHAMP_LOYER }]);
    expect(CHAMP_LOYER).toBe('hypotheses.location.loyerHc');
    for (const m of manques) expect(() => ManqueSchema.parse(m)).not.toThrow();
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
    const manques = [{ code: 'LOYER_ABSENT' as const, champ: CHAMP_LOYER }];
    expect(raisonParmi(manques, ['LOYER_ABSENT'])).toBe('LOYER_ABSENT');
    expect(raisonParmi(manques, [])).toBeNull();
    expect(raisonParmi([], ['LOYER_ABSENT'])).toBeNull();
  });
});
