import { describe, expect, it } from 'vitest';

import {
  CLE_LIENS_PARTAGE,
  LIENS_GARDES_PAR_PROJET,
  lienReutilisable,
  liensDuProjet,
  memoriserLien,
  oublierLiens,
  type LienMemorise,
} from '@/stockage/liens-partage';
import { creerProjet } from '@/stockage/projets';

const DIX = '2026-09-15T10:00:00.000Z';
const APRES = '2026-09-15T11:00:00.000Z';

function lien(id: string, modifieLe = DIX, expireLe = '2026-12-14T10:00:00.000Z'): LienMemorise {
  return { id, jeton: `j-${id}`, modifieLe, expireLe };
}

describe('liens de partage gardés sur l’appareil', () => {
  const projet = creerProjet({ nom: 'A', genererId: () => 'p1', maintenant: () => DIX });

  it('réutilise le dernier lien de la même version tant qu’il n’a pas expiré', () => {
    const s = window.localStorage;
    expect(lienReutilisable(s, projet, DIX)).toBeNull();
    memoriserLien(s, 'p1', lien('AAAAAAAA'));
    expect(lienReutilisable(s, projet, APRES)?.id).toBe('AAAAAAAA');
    expect(lienReutilisable(s, { ...projet, modifieLe: APRES }, APRES)).toBeNull();
    expect(lienReutilisable(s, projet, '2027-01-01T00:00:00.000Z')).toBeNull();
    memoriserLien(s, 'p1', lien('BBBBBBBB', APRES));
    expect(lienReutilisable(s, projet, APRES)).toBeNull();
  });

  it('garde au plus 20 liens par projet et oublie ceux qu’on a éteints', () => {
    const s = window.localStorage;
    for (let i = 0; i < LIENS_GARDES_PAR_PROJET + 3; i += 1) {
      memoriserLien(s, 'p1', lien(`L${String(i).padStart(7, '0')}`));
    }
    const liens = liensDuProjet(s, 'p1');
    expect(liens).toHaveLength(LIENS_GARDES_PAR_PROJET);
    expect(liens[0]?.id).toBe('L0000003');
    oublierLiens(s, 'p1', ['L0000003']);
    expect(liensDuProjet(s, 'p1')).toHaveLength(LIENS_GARDES_PAR_PROJET - 1);
    oublierLiens(
      s,
      'p1',
      liensDuProjet(s, 'p1').map((l) => l.id),
    );
    expect(JSON.parse(s.getItem(CLE_LIENS_PARTAGE) ?? '')).toEqual({});
    oublierLiens(s, 'inconnu', []);
    expect(liensDuProjet(s, 'inconnu')).toEqual([]);
  });

  it('un contenu illisible ou hors schéma vaut une mémoire vide ; un stockage plein n’interrompt rien', () => {
    const s = window.localStorage;
    s.setItem(CLE_LIENS_PARTAGE, '{pas du json');
    expect(liensDuProjet(s, 'p1')).toEqual([]);
    s.setItem(CLE_LIENS_PARTAGE, JSON.stringify({ p1: [{ id: 'court' }] }));
    expect(liensDuProjet(s, 'p1')).toEqual([]);

    const plein = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    } as unknown as Storage;
    expect(() => {
      memoriserLien(plein, 'p1', lien('AAAAAAAA'));
    }).not.toThrow();
  });
});
