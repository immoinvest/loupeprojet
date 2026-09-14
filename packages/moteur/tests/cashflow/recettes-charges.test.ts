import { describe, expect, it } from 'vitest';

import { chargesExploitation, estMeuble, totalCharges } from '../../src/cashflow/charges';
import { recettesAnnuelles } from '../../src/cashflow/recettes';
import { projetExemple } from '../../src/exemples/t3-marseille';
import {
  LocationSchema,
  loyerConnu,
  parserComplet,
  type Hypotheses,
  type LocationComplete,
  type LocationEntree,
} from '../../src/schema';

const projet = parserComplet(projetExemple);
const location = projet.hypotheses.location;

/** Une location validée dont le loyer est donné : recettes et charges n'existent qu'avec lui. */
function complete(entree: LocationEntree): LocationComplete {
  const l = LocationSchema.parse(entree);
  if (!loyerConnu(l)) throw new Error('loyer attendu');
  return l;
}

const par = (lignes: ReturnType<typeof chargesExploitation>): Record<string, number> =>
  Object.fromEntries(lignes.map((l) => [l.code, l.annuel]));

describe('recettesAnnuelles — nue et meublée', () => {
  it('980 € × 12 = 11 760 € bruts, 3 semaines de vacance = 678 €, nets 11 082 €', () => {
    const r = recettesAnnuelles(location);
    expect(r.mode).toBe('meuble');
    expect(r.loyersBruts).toBe(11_760);
    expect(r.chargesRecuperees).toBe(0);
    expect(r.vacance).toBeCloseTo((11_760 * 3) / 52, 6);
    expect(r.loyersNets).toBeCloseTo(11_760 - (11_760 * 3) / 52, 6);
    expect(r.nuitees).toBeNull();
    expect(r.sejours).toBeNull();
  });

  it('une location nue à 850 € : 10 200 € bruts', () => {
    const nu = complete({ mode: 'nu', loyerHc: 850 });
    const r = recettesAnnuelles(nu);
    expect(r.mode).toBe('nu');
    expect(r.loyersBruts).toBe(10_200);
  });

  it('sans vacance, nets = bruts', () => {
    const sansVacance = complete({ mode: 'nu', loyerHc: 700, vacanceSemaines: 0 });
    expect(recettesAnnuelles(sansVacance).loyersNets).toBe(8_400);
  });
});

describe('recettesAnnuelles — colocation', () => {
  it('4 chambres à 460 € (Excel Projet 92K) : 22 080 € bruts, forfaits en recettes, vacance sur le tout', () => {
    const coloc = complete({
      mode: 'colocation',
      chambres: 4,
      loyerChambre: 460,
      forfaitChargesChambre: 55,
      vacanceSemaines: 4,
    });
    const r = recettesAnnuelles(coloc);
    expect(r.mode).toBe('colocation');
    expect(r.loyersBruts).toBe(460 * 4 * 12);
    expect(r.chargesRecuperees).toBe(55 * 4 * 12);
    expect(r.vacance).toBeCloseTo(((22_080 + 2_640) * 4) / 52, 6);
    expect(r.loyersNets).toBeCloseTo(24_720 - r.vacance, 6);
    expect(r.sejours).toBeNull();
  });
});

describe('recettesAnnuelles — courte durée (Excel Projet 92K)', () => {
  const cd = complete({
    mode: 'courte_duree',
    nuitee: 50,
    nuiteesParMois: 15,
    dureeSejourNuits: 3.75,
    menageFactureParSejour: 27,
    menageCoutParSejour: 20,
    plateformeTaux: 0.03,
    conciergerieTaux: 0.2,
  });

  it('50 € × 15 nuits × 12 = 9 000 € ; 48 séjours × 27 € de ménage facturé = 1 296 € ; pas de vacance', () => {
    const r = recettesAnnuelles(cd);
    expect(r.nuitees).toBe(180);
    expect(r.sejours).toBe(48);
    expect(r.loyersBruts).toBe(9_000);
    expect(r.chargesRecuperees).toBe(1_296);
    expect(r.vacance).toBe(0);
    expect(r.loyersNets).toBe(10_296);
  });

  it('les frais du type sont des charges : plateforme et conciergerie sur les recettes, ménage par séjour', () => {
    const r = recettesAnnuelles(cd);
    const lignes = par(chargesExploitation(projet.hypotheses, cd, 'lmnp_reel', r));
    expect(lignes.plateforme).toBeCloseTo(10_296 * 0.03, 6);
    expect(lignes.conciergerie).toBeCloseTo(10_296 * 0.2, 6);
    expect(lignes.menage).toBe(48 * 20);
    expect(lignes.gestion).toBe(0);
  });
});

describe('recettesAnnuelles — moyenne durée', () => {
  const md = complete({
    mode: 'moyenne_duree',
    loyerHc: 900,
    forfaitCharges: 120,
    dureeSejourMois: 4,
    vacanceSemaines: 4,
    menageCoutParSejour: 80,
    plateformeTaux: 0.05,
    gestionTaux: 0.06,
  });

  it('loyer et forfait × 12, vacance sur le total, séjours sur les mois occupés', () => {
    const r = recettesAnnuelles(md);
    expect(r.loyersBruts).toBe(10_800);
    expect(r.chargesRecuperees).toBe(1_440);
    expect(r.vacance).toBeCloseTo((12_240 * 4) / 52, 6);
    expect(r.sejours).toBeCloseTo((12 * (1 - 4 / 52)) / 4, 10);
    expect(r.nuitees).toBeNull();
  });

  it('gestion et plateforme sur les recettes, ménage par séjour', () => {
    const r = recettesAnnuelles(md);
    const lignes = par(chargesExploitation(projet.hypotheses, md, 'lmnp_reel', r));
    expect(lignes.gestion).toBeCloseTo(r.loyersNets * 0.06, 6);
    expect(lignes.plateforme).toBeCloseTo(r.loyersNets * 0.05, 6);
    expect(lignes.menage).toBeCloseTo((r.sejours ?? 0) * 80, 6);
    expect(lignes.conciergerie).toBe(0);
  });
});

describe('chargesExploitation', () => {
  const recettes = recettesAnnuelles(location);

  it('au réel meublé : toutes les lignes, dont comptable et CFE ; frais du type et abonnements à 0', () => {
    const lignes = chargesExploitation(projet.hypotheses, location, 'lmnp_reel', recettes);
    expect(par(lignes)).toEqual({
      taxeFonciere: 1_050,
      copro: 1_080,
      pno: 180,
      comptable: 420,
      cfe: 180,
      gestion: 0,
      conciergerie: 0,
      plateforme: 0,
      menage: 0,
      energie: 0,
      internet: 0,
      entretien: 775,
    });
    expect(totalCharges(lignes)).toBe(3_685);
  });

  it('en micro-BIC : CFE mais pas de comptable', () => {
    const lignes = par(chargesExploitation(projet.hypotheses, location, 'micro_bic', recettes));
    expect(lignes.comptable).toBe(0);
    expect(lignes.cfe).toBe(180);
  });

  it('en nu : ni comptable ni CFE ; la gestion suit les loyers nets', () => {
    const nu: LocationComplete = {
      mode: 'nu',
      loyerHc: 850,
      chargesLocataire: 0,
      vacanceSemaines: 0,
      gestionTaux: 0.07,
    };
    const r = recettesAnnuelles(nu);
    const lignes = par(chargesExploitation(projet.hypotheses, nu, 'nu_reel', r));
    expect(lignes.comptable).toBe(0);
    expect(lignes.cfe).toBe(0);
    expect(lignes.gestion).toBeCloseTo(10_200 * 0.07, 8);
  });

  it('énergie et internet du propriétaire comptent douze mois', () => {
    const hypotheses: Hypotheses = {
      ...projet.hypotheses,
      charges: { ...projet.hypotheses.charges, energieMensuel: 190, internetMensuel: 30 },
    };
    const lignes = par(chargesExploitation(hypotheses, location, 'lmnp_reel', recettes));
    expect(lignes.energie).toBe(2_280);
    expect(lignes.internet).toBe(360);
  });

  it('estMeuble distingue les régimes', () => {
    expect(estMeuble('micro_bic')).toBe(true);
    expect(estMeuble('lmnp_reel')).toBe(true);
    expect(estMeuble('micro_foncier')).toBe(false);
    expect(estMeuble('nu_reel')).toBe(false);
  });
});
