import { describe, expect, it } from 'vitest';

import {
  caseFoncier,
  caseMicroBic,
  explicationReelPrevu,
  libelleEcheance,
  libelleLoyer,
  ligne2044,
  nomFichierExport,
  phraseEcart,
  plafondDeficit,
  plafondDuRegime,
  tauxEntier,
  TEXTES_REEL_PREVU,
  titreDeclaration,
  titreEcart,
} from '@/textes/gerer-declaration';

/** `montant()` met une espace fine insécable dans les milliers et avant « € ». */
function espaces(texte: string): string {
  return texte.replace(/\s/g, ' ');
}

describe('textes de la déclaration', () => {
  it('titre, lignes et cases avec « à confirmer » hors de l’année relue', () => {
    expect(titreDeclaration(2026)).toBe('Déclaration 2027 (revenus 2026)');
    expect(ligne2044('travaux', true)).toBe('ligne 224');
    expect(ligne2044('interets', false)).toBe('ligne 250 (à confirmer)');
    expect(caseFoncier('microFoncier', true)).toBe('case 4BE');
    expect(caseFoncier('deficitRevenuGlobal', false)).toBe('case 4BC (à confirmer)');
    expect(caseMicroBic(true)).toBe('case 5NI (5OI pour le déclarant 2)');
    expect(caseMicroBic(false)).toBe('case 5NI (5OI pour le déclarant 2) (à confirmer)');
  });

  it('taux, plafonds, nom du fichier, libellés de l’export', () => {
    expect(tauxEntier(0.3)).toBe('30 %');
    expect(espaces(plafondDuRegime(1_500_000))).toBe('Plafond : 15 000 € de recettes');
    expect(espaces(plafondDeficit(1_070_000))).toBe(
      'Au plus 10 700 € de déficit sur ton revenu global.',
    );
    expect(nomFichierExport(2026)).toBe('deklic-gestion-2026.csv');
    expect(libelleLoyer('mars 2026', 'Julie Martin')).toBe('Loyer de mars 2026 · Julie Martin');
    expect(libelleLoyer('mars 2026', null)).toBe('Loyer de mars 2026');
    expect(libelleEcheance('mars 2026')).toBe('Échéance de mars 2026');
    expect(libelleEcheance('octobre 2026')).toBe('Échéance d’octobre 2026');
    expect(libelleLoyer('août 2026', null)).toBe('Loyer d’août 2026');
  });
});

describe('textes du réel contre prévu', () => {
  it('le titre de l’écart, arrondi à l’euro ; conforme sous 1 €', () => {
    expect(espaces(titreEcart(-3_800))).toBe('38 €/mois de moins que prévu');
    expect(espaces(titreEcart(1_250))).toBe('13 €/mois de plus que prévu');
    expect(titreEcart(-99)).toBe(TEXTES_REEL_PREVU.conforme);
    expect(titreEcart(0)).toBe(TEXTES_REEL_PREVU.conforme);
  });

  it('un écart de loyers dit « de moins » quand il manque, une dépense « de plus » quand elle coûte', () => {
    expect(espaces(phraseEcart({ poste: 'loyers', prevu: 0, reel: 0, effet: -4_000 }))).toBe(
      'Loyers encaissés : 40 €/mois de moins',
    );
    expect(espaces(phraseEcart({ poste: 'loyers', prevu: 0, reel: 0, effet: 500 }))).toBe(
      'Loyers encaissés : 5 €/mois de plus',
    );
    expect(espaces(phraseEcart({ poste: 'taxe_fonciere', prevu: 0, reel: 0, effet: -1_400 }))).toBe(
      'Taxe foncière : 14 €/mois de plus',
    );
    expect(espaces(phraseEcart({ poste: 'gestion', prevu: 0, reel: 0, effet: 500 }))).toBe(
      'Gestion et comptable : 5 €/mois de moins',
    );
  });

  it('l’explication dit la durée et la version de règles', () => {
    expect(explicationReelPrevu(1, '2026-09')).toBe(
      'Moyenne de 1 mois complet, avant impôt, contre l’analyse recalculée avec ses règles (2026-09).',
    );
    expect(explicationReelPrevu(12, '2026-09')).toContain('12 mois complets');
  });
});
