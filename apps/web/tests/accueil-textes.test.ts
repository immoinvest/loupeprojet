import { describe, expect, it } from 'vitest';

import {
  BOUTONS_ETAPE,
  nombreDeBiens,
  phraseEtape,
  projetsAEtudier,
  titreAccueil,
} from '@/textes/accueil';

describe('textes de l’accueil', () => {
  it('titre : le prénom, sinon la bienvenue', () => {
    expect(titreAccueil('Camille Roux')).toBe('Bonjour Camille');
    expect(titreAccueil('  Léa  ')).toBe('Bonjour Léa');
    expect(titreAccueil('')).toBe('Bienvenue sur Deklic');
    expect(titreAccueil('   ')).toBe('Bienvenue sur Deklic');
    expect(titreAccueil(null)).toBe('Bienvenue sur Deklic');
  });

  it('pluriels', () => {
    expect(projetsAEtudier(0)).toBe('projet à l’étude');
    expect(projetsAEtudier(1)).toBe('projet à l’étude');
    expect(projetsAEtudier(2)).toBe('projets à l’étude');
    expect(nombreDeBiens(1)).toBe('1 bien');
    expect(nombreDeBiens(3)).toBe('3 biens');
  });

  it('une phrase et un bouton par prochaine étape', () => {
    expect(phraseEtape('gerer', 'T2 Lices')).toBe('Tu as acheté T2 Lices : fais-le travailler.');
    expect(phraseEtape('financement', 'T2 Lices')).toBe(
      'Offre faite sur T2 Lices : sécurise ton financement.',
    );
    expect(phraseEtape('visite', 'T2 Lices')).toBe(
      'Visite prévue pour T2 Lices : prépare tes questions.',
    );
    expect(phraseEtape('rapport', 'T2 Lices')).toBe('T2 Lices attend ton verdict.');
    expect(BOUTONS_ETAPE).toEqual({
      gerer: 'Gérer ce bien',
      financement: 'Vérifier le financement',
      visite: 'Préparer la visite',
      rapport: 'Voir le rapport',
    });
  });
});
