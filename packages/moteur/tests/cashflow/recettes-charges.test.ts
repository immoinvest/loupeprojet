import { describe, expect, it } from 'vitest';

import { chargesExploitation, estMeuble, totalCharges } from '../../src/cashflow/charges';
import { recettesAnnuelles } from '../../src/cashflow/recettes';
import { projetExemple } from '../../src/exemples/t3-marseille';
import { LocationSchema, ProjetSchema } from '../../src/schema';

const projet = ProjetSchema.parse(projetExemple);
const location = projet.hypotheses.location;

describe('recettesAnnuelles — longue durée', () => {
  it('980 € × 12 = 11 760 € bruts, 3 semaines de vacance = 678 €, nets 11 082 €', () => {
    const r = recettesAnnuelles(location);
    expect(r.mode).toBe('meuble_lld');
    expect(r.loyersBruts).toBe(11_760);
    expect(r.vacance).toBeCloseTo((11_760 * 3) / 52, 6);
    expect(r.loyersNets).toBeCloseTo(11_760 - (11_760 * 3) / 52, 6);
    expect(r.courteDuree).toBeNull();
  });

  it('accepte un autre loyer et un autre mode (régimes nus)', () => {
    const r = recettesAnnuelles(location, { mode: 'nu', loyerHc: 850 });
    expect(r.mode).toBe('nu');
    expect(r.loyersBruts).toBe(10_200);
  });

  it('sans vacance, nets = bruts', () => {
    const sansVacance = LocationSchema.parse({ mode: 'nu', loyerHc: 700, vacanceSemaines: 0 });
    expect(recettesAnnuelles(sansVacance).loyersNets).toBe(8_400);
  });
});

describe('recettesAnnuelles — courte durée', () => {
  const cd = LocationSchema.parse({
    mode: 'courte_duree',
    loyerHc: 0,
    courteDuree: { nuitee: 75, tauxOccupation: 0.6, fraisMenageParNuit: 15, conciergerieTaux: 0.2 },
  });

  it('75 € × 365 × 60 % = 16 425 € − ménage 3 285 € − conciergerie 3 285 € = 9 855 €', () => {
    const r = recettesAnnuelles(cd);
    expect(r.courteDuree?.nuitees).toBe(219);
    expect(r.loyersBruts).toBe(16_425);
    expect(r.courteDuree?.menage).toBe(3_285);
    expect(r.courteDuree?.conciergerie).toBe(3_285);
    expect(r.loyersNets).toBe(9_855);
    expect(r.vacance).toBe(0);
  });

  it('en surchargeant le mode vers le nu, revient au loyer mensuel', () => {
    const r = recettesAnnuelles(cd, { mode: 'nu', loyerHc: 600 });
    expect(r.loyersBruts).toBe(7_200);
  });
});

describe('chargesExploitation', () => {
  it('au réel meublé : toutes les lignes, dont comptable et CFE', () => {
    const lignes = chargesExploitation(projet.hypotheses, 'lmnp_reel', 11_000);
    const par = Object.fromEntries(lignes.map((l) => [l.code, l.annuel]));
    expect(par).toEqual({
      taxeFonciere: 1_050,
      copro: 1_080,
      pno: 180,
      comptable: 420,
      cfe: 180,
      gestion: 0,
      entretien: 775,
    });
    expect(totalCharges(lignes)).toBe(3_685);
  });

  it('en micro-BIC : CFE mais pas de comptable', () => {
    const par = Object.fromEntries(
      chargesExploitation(projet.hypotheses, 'micro_bic', 11_000).map((l) => [l.code, l.annuel]),
    );
    expect(par.comptable).toBe(0);
    expect(par.cfe).toBe(180);
  });

  it('en nu : ni comptable ni CFE ; la gestion suit les loyers nets', () => {
    const avecGestion = {
      ...projet.hypotheses,
      location: { ...projet.hypotheses.location, gestionTaux: 0.07 },
    };
    const par = Object.fromEntries(
      chargesExploitation(avecGestion, 'nu_reel', 10_000).map((l) => [l.code, l.annuel]),
    );
    expect(par.comptable).toBe(0);
    expect(par.cfe).toBe(0);
    expect(par.gestion).toBeCloseTo(700, 8);
  });

  it('estMeuble distingue les régimes', () => {
    expect(estMeuble('micro_bic')).toBe(true);
    expect(estMeuble('lmnp_reel')).toBe(true);
    expect(estMeuble('micro_foncier')).toBe(false);
    expect(estMeuble('nu_reel')).toBe(false);
  });
});
