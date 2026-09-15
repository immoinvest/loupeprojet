import { describe, expect, it } from 'vitest';

import { defilementPourCentrer, defilementPourVoir, positionAuRetour } from '@/coque/defilement';

describe('defilementPourCentrer (champ visé par un lien d’hypothèse)', () => {
  const contenu = { defilement: 1000, hauteurVisible: 800 };

  it('centre le champ sous l’en-tête collé', () => {
    // Zone visible sous 100 px d'en-tête : 700 px ; champ de 100 px à 300 px sous le haut visible.
    expect(defilementPourCentrer({ haut: 300, hauteur: 100 }, contenu, 100)).toBe(900);
  });

  it('un champ plus haut que la zone s’aligne sous le masque', () => {
    expect(defilementPourCentrer({ haut: 300, hauteur: 900 }, contenu, 100)).toBe(1200);
  });

  it('le masque ne couvre jamais plus de la moitié de l’écran, ni moins que rien', () => {
    expect(defilementPourCentrer({ haut: 0, hauteur: 0 }, contenu, 5000)).toBe(
      defilementPourCentrer({ haut: 0, hauteur: 0 }, contenu, 400),
    );
    expect(defilementPourCentrer({ haut: 300, hauteur: 100 }, contenu, -50)).toBe(950);
  });

  it('jamais sous zéro', () => {
    expect(
      defilementPourCentrer({ haut: 10, hauteur: 20 }, { defilement: 0, hauteurVisible: 800 }, 0),
    ).toBe(0);
  });
});

describe('positionAuRetour', () => {
  it('rend la position notée seulement en revenant par l’historique', () => {
    expect(positionAuRetour('POP', 480)).toBe(480);
    expect(positionAuRetour('POP', undefined)).toBe(0);
    expect(positionAuRetour('PUSH', 480)).toBe(0);
    expect(positionAuRetour('REPLACE', 480)).toBe(0);
  });
});

/** Bande des volets sur un téléphone de 320 px, au repos. */
const AU_REPOS = { defilement: 0, largeurVisible: 320 };

describe('defilementPourVoir (onglet actif ramené dans la bande)', () => {
  it('ne bouge pas quand l’onglet est déjà visible', () => {
    expect(defilementPourVoir({ debut: 100, largeur: 90 }, AU_REPOS)).toBe(0);
    expect(
      defilementPourVoir({ debut: 300, largeur: 90 }, { defilement: 200, largeurVisible: 320 }),
    ).toBe(200);
  });

  it('ramène un onglet caché à droite, marge comprise', () => {
    // Visite de 400 à 474 px : il faut voir jusqu'à 490 px dans 320 px.
    expect(defilementPourVoir({ debut: 400, largeur: 74 }, AU_REPOS)).toBe(170);
  });

  it('ramène un onglet caché à gauche, sans passer sous zéro', () => {
    const defile = { defilement: 300, largeurVisible: 320 };
    expect(defilementPourVoir({ debut: 120, largeur: 90 }, defile)).toBe(104);
    expect(defilementPourVoir({ debut: 10, largeur: 90 }, defile)).toBe(0);
  });

  it('montre le début d’un élément plus large que la bande', () => {
    expect(defilementPourVoir({ debut: 400, largeur: 500 }, AU_REPOS)).toBe(384);
  });

  it('accepte une marge nulle', () => {
    expect(defilementPourVoir({ debut: 400, largeur: 74 }, AU_REPOS, 0)).toBe(154);
  });
});
