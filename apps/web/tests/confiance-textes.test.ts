import {
  calculerProjet,
  projetExemple,
  type ComposanteConfiance,
  type ConfianceEstimation,
  type Dvf,
} from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import {
  LIBELLES_COMPOSANTES,
  LIBELLES_CONFIANCE,
  LIBELLES_PRECISION,
  libellePeriode,
  moisEnLettres,
  niveauEnPhrase,
  phraseNote,
  phrasePrixAffiche,
  phraseRepere,
  pointsSurMaximum,
  raisonComposante,
  TON_CONFIANCE,
} from '@/textes/confiance';

const n = (s: string): string => s.replace(/\s/g, ' ');

const confiance: ConfianceEstimation = calculerProjet(projetExemple).estimation!.confiance;

function composante(
  code: ComposanteConfiance['code'],
  valeur: number | null,
  supposee = false,
): ComposanteConfiance {
  return { code, valeur, points: 7, maximum: 20, supposee };
}

function avecPrecision(precision: ConfianceEstimation['precision']): ConfianceEstimation {
  return { ...confiance, precision };
}

describe('libellés de la confiance', () => {
  it('cinq niveaux, quatre composantes, quatre précisions, un ton par niveau', () => {
    expect(Object.keys(LIBELLES_CONFIANCE)).toHaveLength(5);
    expect(Object.keys(LIBELLES_COMPOSANTES)).toHaveLength(4);
    expect(Object.keys(LIBELLES_PRECISION)).toHaveLength(4);
    expect(TON_CONFIANCE.elevee).toBe('bon');
    expect(TON_CONFIANCE.tres_faible).toBe('surveiller');
    expect(niveauEnPhrase('tres_faible')).toBe('confiance très faible');
  });

  it('note en mots et points sur le maximum', () => {
    expect(phraseNote(confiance)).toBe('Confiance moyenne · 62 sur 100');
    expect(pointsSurMaximum(composante('comparables', 12))).toBe('7/20');
  });

  it('raison de la localisation selon la précision et le rayon', () => {
    expect(raisonComposante(composante('localisation', null), avecPrecision('immeuble'))).toBe(
      'Ventes du même immeuble ou des parcelles voisines.',
    );
    expect(raisonComposante(composante('localisation', null), avecPrecision('rue'))).toBe(
      'Ventes de la même rue.',
    );
    expect(n(raisonComposante(composante('localisation', 531), avecPrecision('rue')))).toBe(
      'Ventes de la même rue, à 531 m au plus.',
    );
    expect(n(raisonComposante(composante('localisation', 500), avecPrecision('quartier')))).toBe(
      'Ventes du quartier, à 500 m au plus.',
    );
    expect(raisonComposante(composante('localisation', null), avecPrecision('quartier'))).toBe(
      'Ventes du quartier.',
    );
    expect(raisonComposante(composante('localisation', null), avecPrecision('commune'))).toBe(
      'Repère à l’échelle de la commune, sans adresse précise.',
    );
  });

  it('raison des comparables, de la dispersion et de l’ancienneté', () => {
    expect(n(raisonComposante(composante('comparables', 1823), confiance))).toBe(
      '1 823 ventes comparables (même type de logement, surface proche).',
    );
    expect(raisonComposante(composante('comparables', 1), confiance)).toBe(
      '1 vente comparable (même type de logement, surface proche).',
    );
    expect(raisonComposante(composante('comparables', null), confiance)).toContain('0 vente');
    expect(raisonComposante(composante('dispersion', null), confiance)).toBe(
      'Dispersion inconnue : le repère n’a pas de quartiles.',
    );
    expect(n(raisonComposante(composante('dispersion', 0.12), confiance))).toBe(
      'Prix resserrés : la moitié des ventes à ± 6 % de la médiane.',
    );
    expect(n(raisonComposante(composante('dispersion', 0.2295), confiance))).toBe(
      'Prix assez dispersés : la moitié des ventes à ± 11 % de la médiane.',
    );
    expect(n(raisonComposante(composante('dispersion', 0.3804), confiance))).toBe(
      'Prix très dispersés : la moitié des ventes à ± 19 % de la médiane.',
    );
    expect(raisonComposante(composante('anciennete', null), confiance)).toBe(
      'Ancienneté inconnue.',
    );
    expect(raisonComposante(composante('anciennete', 8), confiance)).toBe(
      'Ventes vieilles de 8 mois en médiane.',
    );
    expect(raisonComposante(composante('anciennete', 0), confiance)).toBe(
      'Ventes vieilles de moins d’un mois en médiane.',
    );
    expect(raisonComposante(composante('anciennete', 12, true), confiance)).toBe(
      'Ventes vieilles de 12 mois en médiane (ancienneté inconnue, supposée au milieu de la fenêtre de deux ans des ventes publiées).',
    );
  });

  it('mois en lettres et période', () => {
    expect(moisEnLettres('2024-01-01')).toBe('janvier 2024');
    expect(moisEnLettres('2025-12-31')).toBe('décembre 2025');
    expect(moisEnLettres('2025-13-01')).toBe('2025-13-01');
    expect(libellePeriode({ debut: '2024-01-01', fin: '2025-12-31' })).toBe(
      'entre janvier 2024 et décembre 2025',
    );
  });

  it('phrase du repère : lieu, ventes, période, médiane et quartiles quand on les a', () => {
    const commune: Dvf = {
      medianM2: 3423,
      q1M2: 2833,
      q3M2: 4135,
      nombreVentes: 1823,
      precision: 'commune',
      lieu: 'Marseille 5e Arrondissement',
      periode: { debut: '2024-01-01', fin: '2025-12-31' },
    };
    expect(n(phraseRepere(commune, 'appartement'))).toBe(
      'Appartements vendus à Marseille 5e Arrondissement : 1 823 ventes entre janvier 2024 et décembre 2025, médiane 3 423 €/m², la moitié des ventes entre 2 833 €/m² et 4 135 €/m².',
    );
    expect(n(phraseRepere({ medianM2: 2500, nombreVentes: 1 }, 'maison'))).toBe(
      'Maisons vendues : 1 vente, médiane 2 500 €/m².',
    );
    expect(n(phrasePrixAffiche(155_000, 65))).toBe('Prix affiché : 2 385 €/m² (155 000 €).');
  });
});
