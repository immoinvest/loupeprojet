import { describe, expect, it } from 'vitest';

import { calculerProjet } from '../../src/calculer-projet';
import { projetExemple } from '../../src/exemples/t3-marseille';
import type { ProjetEntree } from '../../src/schema';

const codes = (entree: ProjetEntree): string[] =>
  calculerProjet(entree, { avecScenarios: false }).verdict.vigilance.map((p) => p.code);

const avec = (
  location: ProjetEntree['hypotheses']['location'],
  plafondLoyerMensuel: number,
): ProjetEntree => ({
  ...projetExemple,
  marche: { ...projetExemple.marche, plafondLoyerMensuel },
  hypotheses: { ...projetExemple.hypotheses, location },
});

describe('vigilance — loyer encadré selon le type de location', () => {
  const coloc: ProjetEntree['hypotheses']['location'] = {
    mode: 'colocation',
    chambres: 3,
    loyerChambre: 450,
  };

  it('compare le loyer total des chambres au plafond d’encadrement', () => {
    expect(codes(avec(coloc, 1_300))).toContain('LOYER_AU_DESSUS_PLAFOND');
    expect(codes(avec(coloc, 1_400))).not.toContain('LOYER_AU_DESSUS_PLAFOND');
  });

  it('ne compare jamais une courte durée au plafond d’un loyer mensuel', () => {
    const cd: ProjetEntree['hypotheses']['location'] = {
      mode: 'courte_duree',
      nuitee: 80,
      nuiteesParMois: 15,
    };
    expect(codes(avec(cd, 500))).not.toContain('LOYER_AU_DESSUS_PLAFOND');
  });
});
