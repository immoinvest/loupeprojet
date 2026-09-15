import { describe, expect, it } from 'vitest';

import { estimerPrix } from '../../src/estimation';
import { projetExemple } from '../../src/exemples/t3-marseille';
import { calculerFinancement } from '../../src/financement';
import { calculerFiscalite } from '../../src/fiscalite';
import { obtenirRegles } from '../../src/regles';
import { calculerRevente, valorisationTravaux } from '../../src/revente';
import { parserComplet, type EtatBien, type ProjetEntree } from '../../src/schema';

const regles = obtenirRegles('2026-09');

function variante(
  travaux: number,
  etat?: EtatBien,
  options: { sansDvf?: boolean; prixVente?: number } = {},
): ProjetEntree {
  const marche = projetExemple.marche ?? {};
  return {
    ...projetExemple,
    bien: { ...projetExemple.bien, ...(etat === undefined ? {} : { etat }) },
    marche:
      options.sansDvf === true
        ? Object.fromEntries(Object.entries(marche).filter(([cle]) => cle !== 'dvf'))
        : marche,
    hypotheses: {
      ...projetExemple.hypotheses,
      achat: { ...projetExemple.hypotheses.achat, travaux },
      revente: {
        ...projetExemple.hypotheses.revente,
        ...(options.prixVente === undefined ? {} : { prixVente: options.prixVente }),
      },
    },
  };
}

const valoriser = (p: ProjetEntree): ReturnType<typeof valorisationTravaux> =>
  valorisationTravaux(parserComplet(p), regles);

describe('valorisationTravaux', () => {
  it('sans travaux : rien', () => {
    expect(valoriser(variante(0, 'a_renover'))).toEqual({ montant: 0, methode: 'aucune' });
  });

  it('état inconnu : la moitié des travaux (repli des règles)', () => {
    expect(valoriser(variante(6_000))).toEqual({ montant: 3_000, methode: 'repli' });
  });

  it('état connu mais aucune vente comparable : repli aussi', () => {
    expect(valoriser(variante(6_001, 'a_renover', { sansDvf: true }))).toEqual({
      montant: 3_001,
      methode: 'repli',
    });
  });

  it('à rénover, 39 000 € sur 78 000 € estimés : la moitié de l’écart vers « rénové »', () => {
    // Quartiles 2 700 et 3 400 €/m², 65 m², 3e étage sans ascenseur (−0,9 %) :
    // écart = (3 400 − 2 700) × 65 × 0,991 = 45 090,50 € ; travaux estimés 1 200 × 65 = 78 000 €.
    const p = parserComplet(variante(39_000, 'a_renover'));
    const estimation = estimerPrix(p, regles);
    const ecart = (estimation?.selonEtat.renove ?? 0) - (estimation?.selonEtat.a_renover ?? 0);
    expect(Math.abs(ecart - 45_090.5)).toBeLessThanOrEqual(1);
    const v = valorisationTravaux(p, regles);
    expect(v.methode).toBe('etat');
    expect(v.montant).toBe(Math.round(ecart * 0.5));
  });

  it('jamais plus que le montant des travaux', () => {
    // À rafraîchir : écart ≈ 33 818 € pour 26 000 € de travaux estimés, soit plus d’un euro par euro.
    expect(valoriser(variante(6_000, 'a_rafraichir'))).toEqual({ montant: 6_000, methode: 'etat' });
  });

  it('bon état (aucun travaux estimé) : l’écart entier, borné par les travaux', () => {
    // (3 400 − 3 050) × 65 × 0,991 = 22 545,25 €.
    expect(valoriser(variante(10_000, 'bon_etat')).montant).toBe(10_000);
    expect(Math.abs(valoriser(variante(30_000, 'bon_etat')).montant - 22_545)).toBeLessThanOrEqual(
      1,
    );
  });

  it('déjà rénové : aucun écart, aucune valorisation', () => {
    expect(valoriser(variante(20_000, 'renove'))).toEqual({ montant: 0, methode: 'etat' });
  });
});

describe('prix de vente', () => {
  function revente(p: ProjetEntree): ReturnType<typeof calculerRevente> {
    const projet = parserComplet(p);
    const financement = calculerFinancement(projet, regles);
    return calculerRevente(
      projet,
      financement,
      calculerFiscalite(projet, financement, regles),
      regles,
    );
  }

  it('estimé : (prix retenu + valorisation) × (1 + évolution)^années', () => {
    const r = revente(variante(6_000));
    expect(r.valeurSaisie).toBe(false);
    expect(r.valorisationTravaux.montant).toBe(3_000);
    expect(r.valeurEstimee).toBeCloseTo(158_000 * 1.015 ** 10, 6);
    expect(r.valeur).toBe(r.valeurEstimee);
  });

  it('saisi : remplace la valeur, frais et plus-value calculés dessus, estimation gardée', () => {
    const estime = revente(variante(6_000));
    const r = revente(variante(6_000, undefined, { prixVente: 200_000 }));
    expect(r.valeurSaisie).toBe(true);
    expect(r.valeur).toBe(200_000);
    expect(r.valeurEstimee).toBe(estime.valeurEstimee);
    expect(r.fraisVente.agence).toBeCloseTo(8_000, 6);
    expect(r.plusValue.prixCession).toBeCloseTo(200_000 - 8_500, 6);
  });

  it('saisi : le même prix quel que soit l’horizon', () => {
    const a5 = variante(6_000, undefined, { prixVente: 190_000 });
    const a20: ProjetEntree = {
      ...a5,
      hypotheses: { ...a5.hypotheses, revente: { ...a5.hypotheses.revente, annees: 20 } },
    };
    expect(revente(a5).valeur).toBe(190_000);
    expect(revente(a20).valeur).toBe(190_000);
  });
});
