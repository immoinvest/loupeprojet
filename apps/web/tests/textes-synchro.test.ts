import { describe, expect, it } from 'vitest';

import { alerteSynchro, ETATS_SYNCHRO } from '@/textes/synchro';

describe('alerteSynchro', () => {
  it('rien quand tout va bien, une phrase quand il faut agir', () => {
    expect(alerteSynchro('local')).toBeNull();
    expect(alerteSynchro('en_cours')).toBeNull();
    expect(alerteSynchro('a_jour')).toBeNull();
    expect(alerteSynchro('hors_ligne')).toBe('Hors ligne : envoi au retour du réseau');
    expect(alerteSynchro('reconnexion')).toBe('Session expirée : reconnectez-vous');
  });

  it('la limite affichée est celle du compte', () => {
    expect(ETATS_SYNCHRO.limite).toBe('Limite de 200 projets atteinte');
  });
});
