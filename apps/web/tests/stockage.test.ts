import { projetExemple } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import {
  CLE_STOCKAGE,
  creerProjet,
  ecrireProjets,
  lireProjets,
  nomParDefaut,
} from '@/stockage/projets';

const stockage = (): Storage => window.localStorage;

describe('lireProjets', () => {
  it('rend une liste vide sans contenu, avec un JSON cassé ou un schéma invalide', () => {
    expect(lireProjets(stockage())).toEqual([]);
    stockage().setItem(CLE_STOCKAGE, '{pas du json');
    expect(lireProjets(stockage())).toEqual([]);
    stockage().setItem(CLE_STOCKAGE, JSON.stringify([{ id: 'x' }]));
    expect(lireProjets(stockage())).toEqual([]);
  });

  it('relit ce qui a été écrit', () => {
    const p = creerProjet({
      nom: 'Test',
      genererId: () => 'id-1',
      maintenant: () => '2026-09-13T00:00:00.000Z',
    });
    ecrireProjets(stockage(), [p]);
    const lus = lireProjets(stockage());
    expect(lus).toHaveLength(1);
    expect(lus[0]?.id).toBe('id-1');
    expect(lus[0]?.nom).toBe('Test');
    expect(lus[0]?.projet.hypotheses.achat.prix).toBe(155_000);
    expect(lus[0]?.projet.hypotheses.location.vacanceSemaines).toBe(3);
  });
});

describe('creerProjet', () => {
  it('génère un identifiant et des dates par défaut, statut « analyse »', () => {
    const p = creerProjet();
    expect(p.id.length).toBeGreaterThan(8);
    expect(p.projet.id).toBe(p.id);
    expect(p.statut).toBe('analyse');
    expect(p.creeLe).toBe(p.modifieLe);
    expect(new Date(p.creeLe).getFullYear()).toBeGreaterThanOrEqual(2026);
  });

  it('accepte une source, un nom et un statut', () => {
    const source = {
      ...projetExemple,
      bien: { ...projetExemple.bien, type: 'maison' as const, surface: 120 },
    };
    const p = creerProjet({ source, statut: 'ecarte' });
    expect(p.nom).toBe('Maison · 120 m² · dépt 13');
    expect(p.statut).toBe('ecarte');
    expect(p.projet.bien.type).toBe('maison');
  });

  it('nomParDefaut pour un appartement', () => {
    expect(nomParDefaut(projetExemple)).toBe('T3 · 65 m² · dépt 13');
  });
});
