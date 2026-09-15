import { calculerProjet, projetExemple, type FeuVerdict, type ProjetEntree } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import { carteExemple, valeurFeu } from '../src/lib/exemple';
import { eurosParMois } from '../src/lib/formatage';

function simple(texte: string): string {
  return texte.replace(/\s/g, ' ');
}

describe('carteExemple', () => {
  it('reprend les cinq feux du moteur, dans l’ordre du rapport', () => {
    const carte = carteExemple();
    expect(carte.feux.map((feu) => feu.libelle)).toEqual([
      'Prix face aux ventes réelles',
      'Rendement net',
      'Cash-flow avant impôt',
      'Crédit ÷ loyer',
      'Risques de l’adresse',
    ]);
    expect(simple(carte.titre)).toBe('Appartement · 65 m² · Marseille 5e');
    expect(carte.sousTitre).toBe('Location meublée · prêt sur 25 ans');
  });

  it('affiche en grand le même cash-flow que le feu, celui du régime retenu', () => {
    const resultats = calculerProjet(projetExemple, { avecScenarios: false });
    if (!resultats.complet) throw new Error('exemple incomplet');
    const regime = resultats.fiscalite.regimes[resultats.fiscalite.retenu];
    const carte = carteExemple();
    expect(carte.montant).toBe(eurosParMois(regime.cashflow.mensuel));
    expect(carte.feux[2]?.valeur).toBe(carte.montant);
    expect(carte.montantLibelle).toMatch(/^de cash-flow avant impôt, /);
    expect(carte.note).toContain(resultats.meta.versionRegles);
  });

  it('refuse un projet sans loyer : l’accueil n’affiche jamais un rapport partiel', () => {
    const sansLoyer: ProjetEntree = {
      ...projetExemple,
      hypotheses: {
        ...projetExemple.hypotheses,
        location: { mode: 'meuble', chargesLocataire: 60, vacanceSemaines: 3 },
      },
    };
    expect(() => carteExemple(sansLoyer)).toThrow(/doit avoir un loyer/);
  });
});

describe('valeurFeu', () => {
  const feu = (axe: FeuVerdict['axe'], valeur: number | null): FeuVerdict => ({
    axe,
    feu: valeur === null ? 'inconnu' : 'bon',
    valeur,
    raison: null,
  });

  it.each<[FeuVerdict['axe'], number | null, string]>([
    ['prix', -0.042, '−4 %'],
    ['rendement', 0.0531, '5,3 %'],
    ['cashflow', 46.2, '+46 €/mois'],
    ['couverture', 0.884, '88 %'],
    ['risques', 0, 'aucun'],
    ['risques', 1, '1 signal'],
    ['risques', 2, '2 signaux'],
    ['cashflow', null, 'inconnu'],
  ])('%s %s → « %s »', (axe, valeur, attendu) => {
    expect(simple(valeurFeu(feu(axe, valeur)))).toBe(attendu);
  });
});
