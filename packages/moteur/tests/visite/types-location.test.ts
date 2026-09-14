import { describe, expect, it } from 'vitest';

import { calculerProjet } from '../../src/calculer-projet';
import { projetExemple } from '../../src/exemples/t3-marseille';
import type { ProjetEntree } from '../../src/schema';
import { questionsPourProjet } from '../../src/visite/questions';
import type { QuestionPosee } from '../../src/visite/types';

const avec = (location: ProjetEntree['hypotheses']['location']): ProjetEntree => ({
  ...projetExemple,
  hypotheses: { ...projetExemple.hypotheses, location },
});

function posees(entree: ProjetEntree): readonly QuestionPosee[] {
  const r = calculerProjet(entree, { avecScenarios: false });
  return questionsPourProjet(r.projet, r);
}
const ids = (entree: ProjetEntree): string[] => posees(entree).map((q) => q.id);

describe('questions de visite selon le type de location', () => {
  it('le loyer actuel ne se demande que pour un loyer mensuel (nue, meublée, moyenne durée)', () => {
    expect(ids(avec({ mode: 'nu', loyerHc: 850 }))).toContain('EXP_LOYER_ACTUEL');
    expect(ids(projetExemple)).toContain('EXP_LOYER_ACTUEL');
    expect(ids(avec({ mode: 'moyenne_duree', loyerHc: 900 }))).toContain('EXP_LOYER_ACTUEL');
    expect(ids(avec({ mode: 'colocation', chambres: 3, loyerChambre: 450 }))).not.toContain(
      'EXP_LOYER_ACTUEL',
    );
    expect(ids(avec({ mode: 'courte_duree', nuitee: 80, nuiteesParMois: 15 }))).not.toContain(
      'EXP_LOYER_ACTUEL',
    );
  });

  it('une vraie colocation : décence des chambres et espaces communs pour les chambres louées', () => {
    const coloc = posees(avec({ mode: 'colocation', chambres: 3, loyerChambre: 450 }));
    const par = (id: string): QuestionPosee | undefined => coloc.find((q) => q.id === id);
    expect(par('EXP_COLOCATION_CHAMBRES')?.parametres).toEqual({ chambreM2: 9 });
    // Trois chambres louées, alors que le bien d'exemple en déclare deux.
    expect(par('EXP_COLOCATION_COMMUNS')?.parametres).toEqual({ chambres: 3 });
    expect(par('EXP_MOYENNE_DUREE')).toBeUndefined();
  });

  it('une vraie courte durée et une vraie moyenne durée posent leurs questions', () => {
    expect(ids(avec({ mode: 'courte_duree', nuitee: 80, nuiteesParMois: 15 }))).toEqual(
      expect.arrayContaining([
        'EXP_COURTE_DUREE_AUTORISATION',
        'EXP_COURTE_DUREE_COPRO',
        'EXP_COURTE_DUREE_TAXES',
      ]),
    );
    expect(ids(avec({ mode: 'moyenne_duree', loyerHc: 900 }))).toContain('EXP_MOYENNE_DUREE');
  });

  it('courte durée : le DPE des meublés de tourisme se questionne quand il est moins bon que D', () => {
    const cd: ProjetEntree['hypotheses']['location'] = {
      mode: 'courte_duree',
      nuitee: 80,
      nuiteesParMois: 15,
    };
    const classe = (dpe: 'D' | 'E' | 'G'): ProjetEntree => ({
      ...avec(cd),
      bien: { ...projetExemple.bien, dpe },
    });
    const dpeG = posees(classe('G')).find((q) => q.id === 'EXP_COURTE_DUREE_DPE');
    expect(dpeG?.parametres).toEqual({
      dpe: 'G',
      classeMinimale: 'E',
      classeTous: 'D',
      annee: 2034,
    });
    expect(dpeG?.source).toContain('Le Meur');
    expect(ids(classe('E'))).toContain('EXP_COURTE_DUREE_DPE');
    expect(ids(classe('D'))).not.toContain('EXP_COURTE_DUREE_DPE');
    const sansDpe = { ...avec(cd), bien: { ...projetExemple.bien, dpe: undefined } };
    expect(ids(sansDpe)).not.toContain('EXP_COURTE_DUREE_DPE');
    // Une meublée classée G n'est pas un meublé de tourisme.
    expect(ids({ ...projetExemple, bien: { ...projetExemple.bien, dpe: 'G' } })).not.toContain(
      'EXP_COURTE_DUREE_DPE',
    );
  });
});
