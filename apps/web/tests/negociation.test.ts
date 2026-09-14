import { AchatSchema } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import { CURSEUR_NEGOCIATION, pourcentNegociation, pourcentPourViser } from '@/analyses';
import {
  PHRASES_ACHAT,
  libelleNegociation,
  libellePrixEnTete,
  libelleTauxNegociation,
  phrasePrixAffiche,
  phrasePrixRetenu,
  resumeTravaux,
} from '@/textes/achat';

const n = (s: string): string => s.replace(/\s/g, ' ');
const achat = AchatSchema.parse({ prix: 155_000 });
const SANS = {
  prixAffiche: 155_000,
  prixRetenu: 155_000,
  negociationTaux: 0,
  negociationMontant: 0,
};
const A_5 = {
  prixAffiche: 155_000,
  prixRetenu: 147_250,
  negociationTaux: 0.05,
  negociationMontant: 7_750,
};

describe('pourcentPourViser', () => {
  it('arrondit au pas de 0,5 % le taux qui amène au prix visé', () => {
    expect(pourcentPourViser(achat, 147_250)).toBe(5);
    // 1 − 143 500 ÷ 155 000 = 7,42 % → 7,5 %
    expect(pourcentPourViser(achat, 143_500)).toBe(7.5);
  });

  it('plafonne au maximum du curseur et garde au moins un pas', () => {
    expect(pourcentPourViser(achat, 50_000)).toBe(CURSEUR_NEGOCIATION.max);
    expect(pourcentPourViser(achat, 154_900)).toBe(CURSEUR_NEGOCIATION.pas);
  });

  it('rend null quand le prix affiché est déjà au niveau ou sous le prix visé', () => {
    expect(pourcentPourViser(achat, 155_000)).toBeNull();
    expect(pourcentPourViser(achat, 206_733)).toBeNull();
  });
});

describe('pourcentNegociation', () => {
  it('convertit le taux stocké en valeur de curseur sans bruit de flottant', () => {
    expect(pourcentNegociation(0.05)).toBe(5);
    expect(pourcentNegociation(0.075)).toBe(7.5);
    expect(pourcentNegociation(0)).toBe(0);
  });
});

describe('textes de l’achat', () => {
  it('libellés de négociation', () => {
    expect(n(libelleNegociation(0))).toBe('0 %');
    expect(n(libelleNegociation(5))).toBe('−5 %');
    expect(n(libelleNegociation(7.5))).toBe('−7,5 %');
    expect(n(libelleNegociation(7.44))).toBe('−7,4 %');
    expect(n(libelleTauxNegociation(0.05))).toBe('−5 %');
  });

  it('phrases du prix', () => {
    expect(n(phrasePrixAffiche(SANS))).toBe('Prix affiché 155 000 €');
    expect(n(phrasePrixAffiche(A_5))).toBe('Prix affiché 155 000 € · retenu 147 250 € (−5 %)');
    expect(n(phrasePrixRetenu(SANS))).toBe('Prix retenu 155 000 €');
    expect(n(phrasePrixRetenu(A_5))).toBe('Prix retenu 147 250 € · −7 750 € (−5 %)');
    expect(n(libellePrixEnTete(SANS))).toBe('155 000 €');
    expect(n(libellePrixEnTete(A_5))).toBe('147 250 € · négocié −5 %');
    expect(n(PHRASES_ACHAT.viser('137 000 €'))).toBe('Prix estimé 137 000 €.');
  });

  it('résumé des travaux', () => {
    expect(n(resumeTravaux(0, 0))).toBe('+ Ajouter des travaux');
    expect(n(resumeTravaux(0, 4_875))).toBe('+ Ajouter des travaux · mobilier 4 875 €');
    expect(n(resumeTravaux(6_000, 5_000))).toBe('Travaux 6 000 € · mobilier 5 000 €');
    expect(n(resumeTravaux(6_000, 0))).toBe('Travaux 6 000 €');
  });
});
