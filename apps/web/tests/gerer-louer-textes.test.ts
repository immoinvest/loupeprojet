import { describe, expect, it } from 'vitest';

import { colocataireNumero, ERREURS_LOUER, titreLouer } from '@/textes/gerer-louer';
import { ERREURS_SAISIE } from '@/textes/gerer-saisie';

describe('textes du formulaire « Louer »', () => {
  it('bouton d’ouverture, numéro de colocataire, une phrase par champ', () => {
    expect(titreLouer(true)).toBe('Ajouter le locataire');
    expect(titreLouer(false)).toBe('Ajouter une location');
    expect(colocataireNumero(2)).toBe('Colocataire 2');
    expect(ERREURS_LOUER.loyer).toBe(ERREURS_SAISIE.loyer);
    expect(ERREURS_LOUER.colocataires).toMatch(/chaque colocataire/);
    expect(ERREURS_LOUER.libelle).toMatch(/40 caractères/);
  });
});
