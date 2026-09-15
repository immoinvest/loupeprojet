import { describe, expect, it } from 'vitest';

import { anneeDepuisRecherche, anneesProposees } from '@/gestion/declaration/page';
import { CHEMIN_DECLARATION, lienDeclaration, lienRecapitulatif } from '@/gestion/parcours';

describe('année de la page Déclaration', () => {
  it('l’année dernière par défaut ; une année passée ou en cours gardée ; le futur et le n’importe quoi refusés', () => {
    const aujourdhui = '2026-09-16';
    expect(anneeDepuisRecherche(new URLSearchParams(), aujourdhui)).toBe(2025);
    expect(anneeDepuisRecherche(new URLSearchParams('annee=2026'), aujourdhui)).toBe(2026);
    expect(anneeDepuisRecherche(new URLSearchParams('annee=2019'), aujourdhui)).toBe(2019);
    expect(anneeDepuisRecherche(new URLSearchParams('annee=2027'), aujourdhui)).toBe(2025);
    expect(anneeDepuisRecherche(new URLSearchParams('annee=20x6'), aujourdhui)).toBe(2025);
  });

  it('l’année dernière d’abord, puis l’année en cours et trois plus anciennes ; l’année affichée ajoutée si besoin', () => {
    expect(anneesProposees('2026-09-16', 2025)).toEqual([2025, 2026, 2024, 2023, 2022]);
    expect(anneesProposees('2026-09-16', 2019)).toEqual([2025, 2026, 2024, 2023, 2022, 2019]);
  });

  it('adresses de la page et du récapitulatif', () => {
    expect(lienDeclaration()).toBe(CHEMIN_DECLARATION);
    expect(lienDeclaration({ annee: 2025 })).toBe('/gerer/declaration?annee=2025');
    expect(lienRecapitulatif(2025)).toBe('/gerer/declaration/imprimer?annee=2025');
  });
});
