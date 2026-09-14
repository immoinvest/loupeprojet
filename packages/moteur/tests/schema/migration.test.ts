import { describe, expect, it } from 'vitest';

import { calculerProjet } from '../../src/calculer-projet';
import { projetExemple } from '../../src/exemples/t3-marseille';
import { DUREE_SEJOUR_MIGRATION_NUITS, ProjetSchema, migrerProjet } from '../../src/schema';

/** Un projet enregistré par l'application avant septembre 2026 (format figé, ne pas modifier). */
const ANCIEN_MEUBLE = {
  ...projetExemple,
  hypotheses: {
    ...projetExemple.hypotheses,
    location: {
      mode: 'meuble_lld',
      loyerHc: 980,
      loyerHcNu: 850,
      chargesLocataire: 60,
      vacanceSemaines: 3,
      gestionTaux: 0.07,
    },
  },
};

const ANCIENNE_COURTE_DUREE = {
  ...projetExemple,
  hypotheses: {
    ...projetExemple.hypotheses,
    location: {
      mode: 'courte_duree',
      loyerHc: 0,
      vacanceSemaines: 3,
      gestionTaux: 0,
      courteDuree: {
        nuitee: 75,
        tauxOccupation: 0.6,
        fraisMenageParNuit: 15,
        conciergerieTaux: 0.2,
        tourismeClasse: true,
      },
    },
  },
};

describe('migrerProjet', () => {
  it('« meuble_lld » devient « meuble », le reste est conservé', () => {
    const migre = migrerProjet(ANCIEN_MEUBLE) as typeof projetExemple;
    expect(migre.hypotheses.location).toEqual({
      mode: 'meuble',
      loyerHc: 980,
      loyerHcNu: 850,
      chargesLocataire: 60,
      vacanceSemaines: 3,
      gestionTaux: 0.07,
    });
    const projet = ProjetSchema.parse(migre);
    expect(calculerProjet(projet).cashflow?.recettes.loyersBruts).toBe(11_760);
  });

  it('la courte durée : occupation → nuitées par mois, ménage par nuit → coût par séjour', () => {
    const migre = migrerProjet(ANCIENNE_COURTE_DUREE) as typeof projetExemple;
    expect(migre.hypotheses.location).toEqual({
      mode: 'courte_duree',
      nuitee: 75,
      // 60 % × 365 ÷ 12 = 18,25 nuits par mois.
      nuiteesParMois: 18.3,
      dureeSejourNuits: DUREE_SEJOUR_MIGRATION_NUITS,
      menageFactureParSejour: 0,
      menageCoutParSejour: 15 * DUREE_SEJOUR_MIGRATION_NUITS,
      plateformeTaux: 0,
      conciergerieTaux: 0.2,
      tourismeClasse: true,
    });
    expect(() => ProjetSchema.parse(migre)).not.toThrow();
  });

  it('une ancienne courte durée en gestion déléguée : la gestion devient une conciergerie', () => {
    const ancien = {
      ...ANCIENNE_COURTE_DUREE,
      hypotheses: {
        ...ANCIENNE_COURTE_DUREE.hypotheses,
        location: {
          ...ANCIENNE_COURTE_DUREE.hypotheses.location,
          gestionTaux: 0.05,
          courteDuree: { nuitee: 75, tauxOccupation: 1 },
        },
      },
    };
    const migre = migrerProjet(ancien) as typeof projetExemple;
    expect(migre.hypotheses.location).toMatchObject({
      mode: 'courte_duree',
      nuiteesParMois: 30.4,
      conciergerieTaux: 0.05,
      menageCoutParSejour: 0,
      tourismeClasse: false,
    });
    expect(ProjetSchema.safeParse(migre).success).toBe(true);
  });

  it('une ancienne location nue perd son sous-objet courte durée', () => {
    const ancien = {
      ...projetExemple,
      hypotheses: {
        ...projetExemple.hypotheses,
        location: { mode: 'nu', loyerHc: 850, courteDuree: { nuitee: 75, tauxOccupation: 0.6 } },
      },
    };
    const migre = migrerProjet(ancien) as typeof projetExemple;
    expect(migre.hypotheses.location).toEqual({ mode: 'nu', loyerHc: 850 });
  });

  it('est idempotente : un projet au format courant ressort identique (même référence)', () => {
    expect(migrerProjet(projetExemple)).toBe(projetExemple);
    const nu = {
      ...projetExemple,
      hypotheses: { ...projetExemple.hypotheses, location: { mode: 'nu', loyerHc: 850 } },
    };
    expect(migrerProjet(nu)).toBe(nu);
    const cd = migrerProjet(ANCIENNE_COURTE_DUREE);
    expect(migrerProjet(cd)).toBe(cd);
  });

  it('rend tel quel ce qui n’est pas un projet', () => {
    expect(migrerProjet(null)).toBeNull();
    expect(migrerProjet('texte')).toBe('texte');
    expect(migrerProjet([1, 2])).toEqual([1, 2]);
    expect(migrerProjet({ id: 'x' })).toEqual({ id: 'x' });
    expect(migrerProjet({ hypotheses: { location: 'nu' } })).toEqual({
      hypotheses: { location: 'nu' },
    });
    const inconnu = { hypotheses: { location: { mode: 'inconnu' } } };
    expect(migrerProjet(inconnu)).toBe(inconnu);
  });
});
