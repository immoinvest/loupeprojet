import { describe, expect, it } from 'vitest';

import {
  CATEGORIES_TEXTE,
  conditionsDuPret,
  dureeEnLettres,
  moisCourt,
  enregistrerLePretDe,
  montantDuBien,
  montantSigne,
  nomDeLaVue,
  phraseArgent,
  pourcentage,
  pretPropose,
  recurrenceEnLettres,
} from '@/textes/gerer-argent';

/** `montant()` met une espace fine insécable : on compare avec des espaces ordinaires. */
function simple(texte: string): string {
  return texte.replace(/\s/g, ' ');
}

describe('textes de la page Argent', () => {
  it('montants signés et phrase de tête', () => {
    expect(simple(montantSigne(41_200))).toBe('+412 €');
    expect(simple(montantSigne(-3_250))).toBe('−32,50 €');
    expect(simple(montantSigne(0))).toBe('0 €');
    expect(nomDeLaVue({ type: 'mois', periode: '2026-10' })).toBe('octobre 2026');
    expect(nomDeLaVue({ type: 'annee', annee: 2026 })).toBe('2026');
    expect(simple(phraseArgent({ type: 'mois', periode: '2026-10' }, 41_200))).toBe(
      'En octobre 2026, tes biens t’ont rapporté 412 € après crédit.',
    );
    expect(simple(phraseArgent({ type: 'annee', annee: 2026 }, -3_200))).toBe(
      'En 2026, tes biens t’ont coûté 32 € après crédit.',
    );
    expect(phraseArgent({ type: 'annee', annee: 2026 }, 0)).toBe(
      'En 2026, tes biens ne t’ont rien rapporté ni coûté après crédit.',
    );
  });

  it('prêt : taux, durée, phrase de l’analyse ; « À faire »', () => {
    expect(pourcentage(0.0335)).toBe('3,35 %');
    expect(pourcentage(0.03)).toBe('3 %');
    expect(dureeEnLettres(300)).toBe('25 ans');
    expect(dureeEnLettres(210)).toBe('17 ans et 6 mois');
    expect(dureeEnLettres(12)).toBe('1 an');
    expect(dureeEnLettres(8)).toBe('8 mois');
    expect(simple(pretPropose(15_000_000, 0.0335, 300))).toBe(
      'L’analyse prévoyait 150 000 € à 3,35 % sur 25 ans.',
    );
    expect(enregistrerLePretDe('T2 Lices')).toBe('Enregistrer le prêt de T2 Lices');
    expect(simple(conditionsDuPret(1_200_000, 0.12, 12))).toBe('12 000 € à 12 % sur 1 an');
    expect(moisCourt('2026-10')).toBe('oct.');
  });

  it('dépenses : catégories, récurrence en lettres, nom accessible d’un montant', () => {
    expect(CATEGORIES_TEXTE.taxe_fonciere).toBe('Taxe foncière');
    expect(recurrenceEnLettres({})).toBe('');
    expect(recurrenceEnLettres({ recurrence: { frequence: 'mensuelle' } })).toBe('Tous les mois');
    expect(
      recurrenceEnLettres({ recurrence: { frequence: 'annuelle', jusquAu: '2027-10-14' } }),
    ).toBe('Tous les ans jusqu’au 14 octobre 2027');
    expect(montantDuBien('Loyers encaissés', 'T2 Lices', '700 €')).toBe(
      'Loyers encaissés de T2 Lices : 700 €',
    );
  });
});
