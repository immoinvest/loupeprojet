import { describe, expect, it } from 'vitest';

import { calculerBase } from '../../src/calculer-base';
import { calculerProjet } from '../../src/calculer-projet';
import { projetExemple } from '../../src/exemples/t3-marseille';
import { obtenirRegles } from '../../src/regles';
import {
  TRANSFORMATIONS,
  avecPrix,
  calculerScenarios,
  indicateurs,
  prixCible,
} from '../../src/scenarios';
import { ProjetSchema, type ProjetEntree } from '../../src/schema';

const regles = obtenirRegles('2026-09');
const projet = ProjetSchema.parse(projetExemple);

const variante = (h: Partial<ProjetEntree['hypotheses']>): ReturnType<typeof ProjetSchema.parse> =>
  ProjetSchema.parse({ ...projetExemple, hypotheses: { ...projetExemple.hypotheses, ...h } });

describe('prixCible', () => {
  it('cash-flow nul : un prix plus bas qui équilibre exactement le cash-flow', () => {
    const cible = prixCible(projet, 'cashflow_zero', regles);
    expect(cible.prix).not.toBeNull();
    expect(cible.prix!).toBeLessThan(155_000);
    expect(cible.ecart!).toBeLessThan(0);
    const recalcul = calculerBase(avecPrix(projet, cible.prix!), regles);
    expect(Math.abs(recalcul.cashflow.mensuel)).toBeLessThan(1);
  });

  it('net 6 % et brut 8 % : le rendement recalculé atteint la cible', () => {
    const net = prixCible(projet, 'net_6', regles);
    const brut = prixCible(projet, 'brut_8', regles);
    expect(calculerBase(avecPrix(projet, net.prix!), regles).rendement.rendements.net).toBeCloseTo(
      0.06,
      4,
    );
    expect(
      calculerBase(avecPrix(projet, brut.prix!), regles).rendement.rendements.brut,
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
  const variantes = TRANSFORMATIONS.map((t) => t(projet, regles));
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

  it('colocation : 2 chambres, loyer total +35 %, vacance 4 semaines, meublé', () => {
    const v = par.colocation!;
    expect(v.parametres.chambres).toBe(2);
    expect(v.parametres.loyerParChambre).toBe(Math.round((980 * 1.35) / 2));
    expect(v.projet.hypotheses.location.loyerHc).toBe(662 * 2);
    expect(v.projet.hypotheses.location.vacanceSemaines).toBe(4);
    expect(v.projet.hypotheses.location.mode).toBe('meuble_lld');
  });

  it('durée : 20 ans (ou 15 si déjà 20) ; taux : +0,5 point', () => {
    expect(par.duree!.projet.hypotheses.pret.dureeAnnees).toBe(20);
    const deja20 = variante({ pret: { ...projetExemple.hypotheses.pret, dureeAnnees: 20 } });
    expect(TRANSFORMATIONS[2]!(deja20, regles).parametres.dureeAnnees).toBe(15);
    expect(par.tauxPlus050!.projet.hypotheses.pret.tauxNominal).toBeCloseTo(0.0385, 10);
  });

  it('nu : loyer nu saisi et régime nu réel ; depuis le nu, bascule en meublé LMNP réel', () => {
    expect(par.nu!.projet.hypotheses.location.mode).toBe('nu');
    expect(par.nu!.projet.hypotheses.location.loyerHc).toBe(850);
    expect(par.nu!.projet.hypotheses.fiscalite.regime).toBe('nu_reel');
    const enNu = variante({
      location: { mode: 'nu', loyerHc: 800 },
      fiscalite: { tmi: 0.3, regime: 'nu_reel' },
    });
    const meuble = TRANSFORMATIONS[4]!(enNu, regles);
    expect(meuble.code).toBe('meuble');
    expect(meuble.projet.hypotheses.location.loyerHc).toBe(920);
    expect(meuble.projet.hypotheses.fiscalite.regime).toBe('lmnp_reel');
    const sansLoyerNu = variante({ location: { mode: 'meuble_lld', loyerHc: 1_150 } });
    expect(TRANSFORMATIONS[4]!(sansLoyerNu, regles).parametres.loyerHc).toBe(1_000);
  });

  it('vacance 2 mois : 8 semaines ; en courte durée, occupation −15 points', () => {
    expect(par.vacance2Mois!.projet.hypotheses.location.vacanceSemaines).toBe(8);
    const cd = variante({
      location: {
        mode: 'courte_duree',
        loyerHc: 0,
        courteDuree: { nuitee: 80, tauxOccupation: 0.6 },
      },
    });
    const v = TRANSFORMATIONS[5]!(cd, regles);
    expect(v.parametres.tauxOccupation).toBeCloseTo(0.45, 10);
    expect(v.projet.hypotheses.location.courteDuree?.tauxOccupation).toBeCloseTo(0.45, 10);
    const cdBas = variante({
      location: {
        mode: 'courte_duree',
        loyerHc: 0,
        courteDuree: { nuitee: 80, tauxOccupation: 0.1 },
      },
    });
    expect(TRANSFORMATIONS[5]!(cdBas, regles).parametres.tauxOccupation).toBe(0);
  });

  it('colocation sans chambres renseignées : pièces − 1, au moins 1', () => {
    const sansChambres = ProjetSchema.parse({
      ...projetExemple,
      bien: { ...projetExemple.bien, chambres: undefined, pieces: 1 },
    });
    expect(TRANSFORMATIONS[1]!(sansChambres, regles).parametres.chambres).toBe(1);
  });

  it('négocier sans prix d’équilibre : −10 % de repli', () => {
    const sansLoyer = variante({ location: { mode: 'nu', loyerHc: 0 } });
    expect(TRANSFORMATIONS[0]!(sansLoyer, regles).parametres.prix).toBe(139_500);
  });
});

describe('calculerScenarios et deltas', () => {
  const base = calculerBase(projet, regles);
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
    expect(rr.rendement.tri).toBeNull();
    expect(rr.scenarios!.scenarios.every((s) => s.deltas.tri === null)).toBe(true);
  });
});

describe('négociation du prix', () => {
  const achatNegocie = { ...projetExemple.hypotheses.achat, negociationTaux: 0.05 };
  const negocie = variante({ achat: achatNegocie });

  it('avecPrix fixe un prix retenu exact : la négociation est remise à zéro', () => {
    const v = avecPrix(negocie, 80_000);
    expect(v.hypotheses.achat).toMatchObject({ prix: 80_000, negociationTaux: 0 });
    expect(calculerBase(v, regles).achat.prixRetenu).toBe(80_000);
  });

  it("l'écart d'un prix cible se lit depuis le prix affiché, celui que l'on négocie", () => {
    const cible = prixCible(negocie, 'cashflow_zero', regles);
    expect(cible.prix).not.toBeNull();
    expect(cible.ecart).toBeCloseTo(cible.prix! / 155_000 - 1, 10);
  });

  it('le repli du levier « Négocier » retient 90 % du prix retenu', () => {
    const sansLoyer = variante({ location: { mode: 'nu', loyerHc: 0 }, achat: achatNegocie });
    const negocier = TRANSFORMATIONS[0]!(sansLoyer, regles);
    expect(negocier.code).toBe('negocier');
    expect(negocier.parametres.prix).toBe(Math.round(147_250 * 0.9));
  });
});
