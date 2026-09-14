import { describe, expect, it } from 'vitest';

import { ETATS_SYNCHRO, ligneSauvegarde } from '@/textes/synchro';

describe('ligneSauvegarde', () => {
  it('sans compte : sur cet appareil ; avec compte : sur le compte et l’état', () => {
    expect(ligneSauvegarde(1, 'local')).toBe('1 projet · sauvegardés sur cet appareil');
    expect(ligneSauvegarde(3, 'a_jour')).toBe('3 projets · sauvegardés sur votre compte · à jour');
    expect(ligneSauvegarde(0, 'hors_ligne')).toBe(
      '0 projet · sauvegardés sur votre compte · hors ligne : envoi au retour du réseau',
    );
  });

  it('la limite affichée est celle du compte', () => {
    expect(ETATS_SYNCHRO.limite).toBe('limite de 200 projets atteinte');
  });
});
