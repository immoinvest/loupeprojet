import { describe, expect, it } from 'vitest';

import { calculerComplet } from '../../src/calculer-base';
import { calculerProjet } from '../../src/calculer-projet';
import { projetExemple } from '../../src/exemples/t3-marseille';
import { obtenirRegles } from '../../src/regles';
import {
  TRANSFORMATIONS,
  avecPrix,
  calculerScenarios,
  indicateurs,
  prixCible,
  type Variante,
} from '../../src/scenarios';
import { parserComplet, type ProjetComplet, type ProjetEntree } from '../../src/schema';

const regles = obtenirRegles('2026-09');
const projet = parserComplet(projetExemple);

const variante = (h: Partial<ProjetEntree['hypotheses']>): ProjetComplet =>
  parserComplet({ ...projetExemple, hypotheses: { ...projetExemple.hypotheses, ...h } });

/** La transformation n'a pas le droit de rendre `null` ici. */
const obligatoire = (v: Variante | null): Variante => {
  if (v === null) throw new Error('scénario absent');
  return v;
};

describe('prixCible', () => {
  it('cash-flow nul : un prix plus bas qui équilibre exactement le cash-flow', () => {
    const cible = prixCible(projet, 'cashflow_zero', regles);
    expect(cible.prix).not.toBeNull();
    expect(cible.prix!).toBeLessThan(155_000);
    expect(cible.ecart!).toBeLessThan(0);
    const recalcul = calculerComplet(avecPrix(projet, cible.prix!), regles);
    expect(Math.abs(recalcul.cashflow.mensuel)).toBeLessThan(1);
  });

  it('net 6 % et brut 8 % : le rendement recalculé atteint la cible', () => {
    const net = prixCible(projet, 'net_6', regles);
    const brut = prixCible(projet, 'brut_8', regles);
    expect(
      calculerComplet(avecPrix(projet, net.prix!), regles).rendement.rendements.net,
    ).toBeCloseTo(0.06, 4);
    expect(
      calculerComplet(avecPrix(projet, brut.prix!), regles).rendement.rendements.brut,
    ).toBeCloseTo(0.08, 4);
  });

  it('rend null quand aucun prix ne convient (loyer nul : cash-flow toujours négatif)', () => {
    const sansLoyer = variante({ location: { mode: 'nu', loyerHc: 0 } });
    expect(prixCible(sansLoyer, 'cashflow_zero', regles).prix).toBeNull();
    expect(prixCible(sansLoyer, 'cashflow_zero', regles).ecart).toBeNull();
  });

  it('honoraires vendeur : le plancher descend à 1 €', () => {
    const vendeur = variante({
      achat: { ...projetExemple.hypotheses.achat, honorairesChargeAcquereur: false },
    });
    expect(prixCible(vendeur, 'cashflow_zero', regles).prix).not.toBeNull();
  });
});

describe('transformations prédéfinies', () => {
  const variantes = TRANSFORMATIONS.map((t) => obligatoire(t(projet, regles)));
  const par = Object.fromEntries(variantes.map((v) => [v.code, v]));

  it('produit six variantes aux codes attendus pour un meublé', () => {
    expect(variantes.map((v) => v.code)).toEqual([
      'negocier',
      'colocation',
      'duree',
      'tauxPlus050',
      'nu',
      'vacance2Mois',
    ]);
  });

  it('négocier : prix arrondi qui équilibre le cash-flow', () => {
    const prix = par.negocier!.parametres.prix as number;
    expect(Number.isInteger(prix)).toBe(true);
    expect(par.negocier!.projet.hypotheses.achat.prix).toBe(prix);
    expect(prix).toBeLessThan(155_000);
  });

  it('colocation : 2 chambres, loyer total +35 %, vacance 4 semaines, forfait et abonnements des règles', () => {
    const v = par.colocation!;
    expect(v.parametres.chambres).toBe(2);
    expect(v.parametres.loyerParChambre).toBe(Math.round((980 * 1.35) / 2));
    expect(v.projet.hypotheses.location).toEqual({
      mode: 'colocation',
      chambres: 2,
      loyerChambre: 662,
      forfaitChargesChambre: 110,
      vacanceSemaines: 4,
      gestionTaux: 0,
    });
    expect(v.projet.hypotheses.charges).toMatchObject({ energieMensuel: 190, internetMensuel: 30 });
    expect(v.projet.hypotheses.fiscalite.regime).toBe('lmnp_reel');
  });

  it('colocation : garde les abonnements déjà saisis et remplace un régime nu par le réel meublé', () => {
    const nu = variante({
      location: { mode: 'nu', loyerHc: 800 },
      charges: { ...projetExemple.hypotheses.charges, energieMensuel: 120, internetMensuel: 25 },
      fiscalite: { tmi: 0.3, regime: 'nu_reel' },
    });
    const v = obligatoire(TRANSFORMATIONS[1]!(nu, regles));
    expect(v.projet.hypotheses.charges).toMatchObject({ energieMensuel: 120, internetMensuel: 25 });
    expect(v.projet.hypotheses.fiscalite.regime).toBe('lmnp_reel');
    // Référence meublée d'une location nue : 800 × 1,15 = 920 ; × 1,35 ÷ 2 chambres.
    expect(v.parametres.loyerParChambre).toBe(Math.round((920 * 1.35) / 2));
  });

  it('colocation : absente quand le projet est déjà une colocation', () => {
    const coloc = variante({ location: { mode: 'colocation', chambres: 3, loyerChambre: 450 } });
    expect(TRANSFORMATIONS[1]!(coloc, regles)).toBeNull();
    expect(calculerScenarios(coloc, calculerComplet(coloc, regles), regles).scenarios).toHaveLength(
      5,
    );
  });

  it('durée : 20 ans (ou 15 si déjà 20) ; taux : +0,5 point', () => {
    expect(par.duree!.projet.hypotheses.pret.dureeAnnees).toBe(20);
    const deja20 = variante({ pret: { ...projetExemple.hypotheses.pret, dureeAnnees: 20 } });
    expect(obligatoire(TRANSFORMATIONS[2]!(deja20, regles)).parametres.dureeAnnees).toBe(15);
    expect(par.tauxPlus050!.projet.hypotheses.pret.tauxNominal).toBeCloseTo(0.0385, 10);
  });

  it('nu : loyer nu saisi et régime nu réel ; depuis le nu, bascule en meublé LMNP réel', () => {
    expect(par.nu!.projet.hypotheses.location).toEqual({
      mode: 'nu',
      loyerHc: 850,
      chargesLocataire: 60,
      vacanceSemaines: 3,
      gestionTaux: 0,
    });
    expect(par.nu!.projet.hypotheses.fiscalite.regime).toBe('nu_reel');
    const enNu = variante({
      location: { mode: 'nu', loyerHc: 800 },
      fiscalite: { tmi: 0.3, regime: 'nu_reel' },
    });
    const meuble = obligatoire(TRANSFORMATIONS[4]!(enNu, regles));
    expect(meuble.code).toBe('meuble');
    expect(meuble.projet.hypotheses.location).toMatchObject({ mode: 'meuble', loyerHc: 920 });
    expect(meuble.projet.hypotheses.fiscalite.regime).toBe('lmnp_reel');
    const sansLoyerNu = variante({ location: { mode: 'meuble', loyerHc: 1_150 } });
    expect(obligatoire(TRANSFORMATIONS[4]!(sansLoyerNu, regles)).parametres.loyerHc).toBe(1_000);
  });

  it('depuis une colocation ou une moyenne durée : passer en meublé longue durée au loyer de référence', () => {
    const coloc = variante({
      location: { mode: 'colocation', chambres: 4, loyerChambre: 460, gestionTaux: 0.08 },
    });
    const v = obligatoire(TRANSFORMATIONS[4]!(coloc, regles));
    expect(v.code).toBe('meuble');
    expect(v.parametres.loyerHc).toBe(Math.round((460 * 4) / 1.35));
    expect(v.projet.hypotheses.location).toMatchObject({
      mode: 'meuble',
      vacanceSemaines: 3,
      gestionTaux: 0.08,
    });
    expect(v.projet.hypotheses.fiscalite.regime).toBe('lmnp_reel');
    const md = variante({ location: { mode: 'moyenne_duree', loyerHc: 900 } });
    expect(obligatoire(TRANSFORMATIONS[4]!(md, regles)).parametres.loyerHc).toBe(900);
  });

  it('depuis une courte durée : le loyer de marché quand il est connu, sinon nuitée × 30 ÷ 2', () => {
    const avecMarche = parserComplet({
      ...projetExemple,
      hypotheses: {
        ...projetExemple.hypotheses,
        location: { mode: 'courte_duree', nuitee: 80, nuiteesParMois: 15, conciergerieTaux: 0.2 },
      },
    });
    const v = obligatoire(TRANSFORMATIONS[4]!(avecMarche, regles));
    // Loyer ANIL 15,1 €/m² × 65 m² × 1,15 = 1 128,725 €.
    expect(v.parametres.loyerHc).toBe(Math.round(15.1 * 65 * 1.15));
    expect(v.projet.hypotheses.location).toMatchObject({ mode: 'meuble', gestionTaux: 0 });
    const sansMarche = parserComplet({
      ...avecMarche,
      marche: { ...projetExemple.marche, loyerReferenceM2: undefined },
    });
    expect(obligatoire(TRANSFORMATIONS[4]!(sansMarche, regles)).parametres.loyerHc).toBe(1_200);
    expect(obligatoire(TRANSFORMATIONS[1]!(sansMarche, regles)).parametres.loyerParChambre).toBe(
      Math.round((1_200 * 1.35) / 2),
    );
  });

  it('vacance 2 mois : 8 semaines ; en courte durée, deux mois de nuitées en moins', () => {
    expect(par.vacance2Mois!.projet.hypotheses.location).toMatchObject({ vacanceSemaines: 8 });
    const cd = variante({ location: { mode: 'courte_duree', nuitee: 80, nuiteesParMois: 18 } });
    const v = obligatoire(TRANSFORMATIONS[5]!(cd, regles));
    expect(v.parametres.nuiteesParMois).toBeCloseTo(15, 10);
    expect(v.projet.hypotheses.location).toMatchObject({
      mode: 'courte_duree',
      nuiteesParMois: 15,
    });
    const coloc = variante({ location: { mode: 'colocation', chambres: 3, loyerChambre: 450 } });
    expect(
      obligatoire(TRANSFORMATIONS[5]!(coloc, regles)).projet.hypotheses.location,
    ).toMatchObject({ mode: 'colocation', vacanceSemaines: 8 });
  });

  it('colocation sans chambres renseignées : pièces − 1, au moins 1', () => {
    const sansChambres = parserComplet({
      ...projetExemple,
      bien: { ...projetExemple.bien, chambres: undefined, pieces: 1 },
    });
    expect(obligatoire(TRANSFORMATIONS[1]!(sansChambres, regles)).parametres.chambres).toBe(1);
  });

  it('négocier sans prix d’équilibre : −10 % de repli', () => {
    const sansLoyer = variante({ location: { mode: 'nu', loyerHc: 0 } });
    expect(obligatoire(TRANSFORMATIONS[0]!(sansLoyer, regles)).parametres.prix).toBe(139_500);
  });
});

describe('calculerScenarios et deltas', () => {
  const base = calculerComplet(projet, regles);
  const r = calculerScenarios(projet, base, regles);

  it('chaque scénario compare ses indicateurs à la référence', () => {
    const ref = indicateurs(base);
    const negocier = r.scenarios.find((s) => s.code === 'negocier')!;
    expect(negocier.indicateurs.cashflowMensuel).toBeCloseTo(0, 0);
    expect(negocier.deltas.cashflowMensuel).toBeCloseTo(-ref.cashflowMensuel, 0);
    expect(negocier.deltas.tri).toBeGreaterThan(0);
    const duree = r.scenarios.find((s) => s.code === 'duree')!;
    expect(duree.deltas.cashflowMensuel).toBeLessThan(0);
    const coloc = r.scenarios.find((s) => s.code === 'colocation')!;
    expect(coloc.deltas.cashflowMensuel).toBeGreaterThan(0);
  });

  it('les prix cibles sont dans l’ordre des critères', () => {
    expect(r.prixCibles.map((p) => p.critere)).toEqual(['cashflow_zero', 'net_6', 'brut_8']);
  });

  it('le delta de TRI est null si un TRI manque (aucun flux positif)', () => {
    // Loyer nul et revente à perte au bout d'un an : tous les flux sont négatifs, le TRI n'existe pas.
    const perte = variante({
      location: { mode: 'nu', loyerHc: 0 },
      revente: { annees: 1, evolutionAnnuelle: -0.2 },
    });
    const rr = calculerProjet(perte);
    expect(rr.complet && rr.rendement.tri).toBeNull();
    expect(rr.scenarios!.scenarios.every((s) => s.deltas.tri === null)).toBe(true);
  });
});

describe('négociation du prix', () => {
  const achatNegocie = { ...projetExemple.hypotheses.achat, negociationTaux: 0.05 };
  const negocie = variante({ achat: achatNegocie });

  it('avecPrix fixe un prix retenu exact : la négociation est remise à zéro', () => {
    const v = avecPrix(negocie, 80_000);
    expect(v.hypotheses.achat).toMatchObject({ prix: 80_000, negociationTaux: 0 });
    expect(calculerComplet(v, regles).achat.prixRetenu).toBe(80_000);
  });

  it("l'écart d'un prix cible se lit depuis le prix affiché, celui que l'on négocie", () => {
    const cible = prixCible(negocie, 'cashflow_zero', regles);
    expect(cible.prix).not.toBeNull();
    expect(cible.ecart).toBeCloseTo(cible.prix! / 155_000 - 1, 10);
  });

  it('le repli du levier « Négocier » retient 90 % du prix retenu', () => {
    const sansLoyer = variante({ location: { mode: 'nu', loyerHc: 0 }, achat: achatNegocie });
    const negocier = obligatoire(TRANSFORMATIONS[0]!(sansLoyer, regles));
    expect(negocier.code).toBe('negocier');
    expect(negocier.parametres.prix).toBe(Math.round(147_250 * 0.9));
  });
});
