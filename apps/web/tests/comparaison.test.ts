import { calculerProjet, projetExemple, type ProjetEntree } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import {
  INDICATEURS,
  MAX_COMPARES,
  comparerProjets,
  indicateurParCode,
  meilleureValeur,
  selectionInitiale,
  triDecroissant,
  trierColonnes,
} from '@/analyses';
import { creerProjet, type ProjetEnregistre } from '@/stockage/projets';

const n = (s: string): string => s.replace(/\s/g, ' ');

function projet(
  nom: string,
  hypotheses: Partial<ProjetEntree['hypotheses']> = {},
): ProjetEnregistre {
  return creerProjet({
    nom,
    genererId: () => nom,
    source: { ...projetExemple, hypotheses: { ...projetExemple.hypotheses, ...hypotheses } },
  });
}

const exemple = projet('exemple');
const rentable = projet('rentable', {
  location: { mode: 'meuble', loyerHc: 1_500, vacanceSemaines: 0 },
});

describe('comparerProjets', () => {
  it('extrait chaque indicateur des résultats du moteur, et les feux', () => {
    const [c] = comparerProjets([exemple]);
    const r = calculerProjet(projetExemple);
    expect(c).toBeDefined();
    expect(c!.id).toBe('exemple');
    expect(c!.valeurs.prix).toBe(155_000);
    expect(c!.valeurs.negociation).toBe(0);
    expect(c!.valeurs.prixM2).toBeCloseTo(155_000 / 65, 6);
    // Écart au prix au m² estimé du bien (3 181 €/m²), plus à la seule médiane.
    expect(c!.valeurs.ecartMarche).toBeCloseTo(155_000 / 65 / 3181 - 1, 6);
    expect(c!.valeurs.loyer).toBe(980);
    expect(c!.valeurs.cashflow).toBeCloseTo(r.cashflow.mensuel, 6);
    expect(c!.valeurs.net).toBeCloseTo(r.rendement.rendements.net, 6);
    expect(c!.valeurs.couverture).toBeCloseTo(r.cashflow.tauxCouverture ?? 0, 6);
    expect(c!.valeurs.impot).toBe(r.fiscalite.regimes.lmnp_reel.impotTotal);
    expect(c!.valeurs.horizon).toBe(10);
    expect(c!.valeurs.cashNet).toBeCloseTo(r.revente.cashNetVendeur, 6);
    expect(c!.valeurs.tri).toBeCloseTo(r.rendement.tri ?? 0, 6);
    expect(c!.valeurs.enrichissement).toBeCloseTo(r.rendement.enrichissement.total, 6);
    expect(c!.valeurs.risques).toBe(0);
    expect(c!.feux).toEqual({
      prix: 'bon',
      rendement: 'surveiller',
      cashflow: 'probleme',
      couverture: 'surveiller',
      risques: 'bon',
    });
  });

  it('formate chaque indicateur', () => {
    const [c] = comparerProjets([exemple]);
    const formats = Object.fromEntries(
      INDICATEURS.map((i) => {
        const v = c!.valeurs[i.code];
        return [i.code, v === null ? '—' : n(i.formater(v))];
      }),
    );
    expect(formats.prix).toBe('155 000 €');
    expect(formats.negociation).toBe('aucune');
    expect(formats.prixM2).toBe('2 385 €/m²');
    expect(formats.ecartMarche).toBe('−25 %');
    expect(formats.cashflow).toBe('−210 €/mois');
    expect(formats.couverture).toBe('84 %');
    expect(formats.horizon).toBe('10 ans');
    expect(formats.risques).toBe('aucun');
    expect(n(indicateurParCode('impot').detail!(c!.resultats))).toBe('Meublé au réel · 10 ans');
    expect(indicateurParCode('loyer').detail!(c!.resultats)).toBe('meublé longue durée');
    expect(INDICATEURS.filter((i) => i.detail === undefined).length).toBe(INDICATEURS.length - 2);
  });

  it('les indicateurs sans repère de marché ou sans loyer rendent null', () => {
    const [c] = comparerProjets([projet('sans', { location: { mode: 'nu', loyerHc: 0 } })]);
    expect(c!.valeurs.couverture).toBeNull();
    expect(c!.valeurs.loyer).toBe(0);
  });
});

describe('trierColonnes', () => {
  const colonnes = comparerProjets([exemple, rentable]);

  it('met la meilleure valeur d’abord selon le sens, et l’inverse à la demande', () => {
    expect(trierColonnes(colonnes, { code: 'cashflow', inverse: false }).map((c) => c.id)).toEqual([
      'rentable',
      'exemple',
    ]);
    expect(trierColonnes(colonnes, { code: 'cashflow', inverse: true }).map((c) => c.id)).toEqual([
      'exemple',
      'rentable',
    ]);
    // « bas » : le prix au m² le plus faible d'abord (identique ici : ordre stable).
    expect(trierColonnes(colonnes, { code: 'prixM2', inverse: false }).map((c) => c.id)).toEqual([
      'exemple',
      'rentable',
    ]);
    expect(trierColonnes(colonnes, { code: 'impot', inverse: false })[0]?.id).toBe('exemple');
    expect(colonnes.map((c) => c.id)).toEqual(['exemple', 'rentable']);
  });

  it('relègue les valeurs absentes en fin, quel que soit le sens', () => {
    const [a, b] = colonnes;
    const sansTri = { ...a!, valeurs: { ...a!.valeurs, tri: null } };
    expect(trierColonnes([sansTri, b!], { code: 'tri', inverse: false }).map((c) => c.id)).toEqual([
      'rentable',
      'exemple',
    ]);
    // Quel que soit l'ordre de départ : l'absent passe derrière.
    expect(trierColonnes([b!, sansTri], { code: 'tri', inverse: false }).map((c) => c.id)).toEqual([
      'rentable',
      'exemple',
    ]);
    expect(
      trierColonnes([sansTri, b!, a!], { code: 'tri', inverse: true }).map((c) => c.id),
    ).toEqual(['exemple', 'rentable', 'exemple']);
    expect(trierColonnes([sansTri, b!], { code: 'tri', inverse: true }).map((c) => c.id)).toEqual([
      'rentable',
      'exemple',
    ]);
    const deuxSans = { ...b!, valeurs: { ...b!.valeurs, tri: null } };
    expect(
      trierColonnes([sansTri, deuxSans], { code: 'tri', inverse: false }).map((c) => c.id),
    ).toEqual(['exemple', 'rentable']);
  });

  it('dit si la ligne triée est décroissante (pour aria-sort)', () => {
    expect(triDecroissant({ code: 'cashflow', inverse: false })).toBe(true);
    expect(triDecroissant({ code: 'cashflow', inverse: true })).toBe(false);
    expect(triDecroissant({ code: 'couverture', inverse: false })).toBe(false);
    expect(triDecroissant({ code: 'couverture', inverse: true })).toBe(true);
  });
});

describe('meilleureValeur', () => {
  const colonnes = comparerProjets([exemple, rentable]);

  it('prend le maximum ou le minimum selon le sens, rien pour un prix ou sans valeur', () => {
    expect(meilleureValeur(colonnes, indicateurParCode('cashflow'))).toBe(
      colonnes[1]!.valeurs.cashflow,
    );
    expect(meilleureValeur(colonnes, indicateurParCode('impot'))).toBe(
      Math.min(colonnes[0]!.valeurs.impot!, colonnes[1]!.valeurs.impot!),
    );
    expect(meilleureValeur(colonnes, indicateurParCode('prix'))).toBeNull();
    const sans = colonnes.map((c) => ({ ...c, valeurs: { ...c.valeurs, tri: null } }));
    expect(meilleureValeur(sans, indicateurParCode('tri'))).toBeNull();
    // Deux projets identiques : aucune valeur n'est meilleure que l'autre, rien en vert.
    const jumeaux = comparerProjets([exemple, projet('copie')]);
    expect(meilleureValeur(jumeaux, indicateurParCode('cashflow'))).toBeNull();
    expect(meilleureValeur(jumeaux, indicateurParCode('tri'))).toBeNull();
  });
});

describe('selectionInitiale', () => {
  it('coche les premiers projets non écartés, cinq au plus, tous s’il en manque', () => {
    const actifs = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) =>
      creerProjet({ nom: id, genererId: () => id }),
    );
    expect(selectionInitiale(actifs)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(MAX_COMPARES).toBe(5);

    const ecarte = creerProjet({ nom: 'x', genererId: () => 'x', statut: 'ecarte' });
    expect(selectionInitiale([ecarte, ...actifs.slice(0, 2)])).toEqual(['a', 'b']);
    expect(selectionInitiale([ecarte, actifs[0]!])).toEqual(['x', 'a']);
    expect(selectionInitiale([])).toEqual([]);
  });
});

describe('négociation du prix', () => {
  it('ajoute « Négociation » et calcule le prix au m² sur le prix retenu', () => {
    const negocie = projet('negocie', {
      achat: { ...projetExemple.hypotheses.achat, negociationTaux: 0.05 },
    });
    const [c] = comparerProjets([negocie]);
    expect(INDICATEURS).toHaveLength(15);
    expect(INDICATEURS.map((i) => i.code).slice(0, 3)).toEqual(['prix', 'negociation', 'prixM2']);
    expect(c!.valeurs.prix).toBe(155_000);
    expect(c!.valeurs.negociation).toBe(0.05);
    expect(c!.valeurs.prixM2).toBeCloseTo(147_250 / 65, 6);
    expect(n(indicateurParCode('negociation').formater(0.05))).toBe('−5 %');
    // La plus forte négociation d'abord ; aucune valeur mise en avant.
    const [premiere] = trierColonnes(comparerProjets([exemple, negocie]), {
      code: 'negociation',
      inverse: false,
    });
    expect(premiere?.id).toBe('negocie');
    expect(
      meilleureValeur(comparerProjets([exemple, negocie]), indicateurParCode('negociation')),
    ).toBeNull();
  });
});
