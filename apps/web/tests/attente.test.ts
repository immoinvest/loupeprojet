import { PortailSchema } from '@loupe/capture';
import { describe, expect, it } from 'vitest';

import {
  DUREES_HABITUELLES_MS,
  etatAttente,
  indiceAstuce,
  INTERVALLE_ASTUCE_MS,
  PROGRESSION_MAX,
  type EtapeAttente,
} from '@/annonces/attente';
import { ASTUCES_ATTENTE, ETAPES_ATTENTE, TEXTES_ATTENTE } from '@/textes/attente';

describe('etatAttente', () => {
  it('SeLoger après 45 s : entre 60 et 90 %, on rassemble les photos et les détails', () => {
    const { progression, etape } = etatAttente(45_000, 'seloger');
    expect(progression).toBeGreaterThan(0.6);
    expect(progression).toBeLessThan(0.9);
    expect(etape).toBe('details');
  });

  it('LeBonCoin après 40 s : plus long que d’habitude, la barre reste sous 95 %', () => {
    const { progression, etape } = etatAttente(40_000, 'leboncoin');
    expect(etape).toBe('long');
    expect(progression).toBeLessThan(PROGRESSION_MAX);
    expect(etatAttente(10 * 60_000, 'bienici').progression).toBeLessThanOrEqual(PROGRESSION_MAX);
  });

  it('étapes dans l’ordre, au début 0 %, jamais de temps négatif', () => {
    const duree = DUREES_HABITUELLES_MS.pap;
    const etapes: EtapeAttente[] = [0, 0.3, 0.6, 1, 2].map(
      (fraction) => etatAttente(fraction * duree, 'pap').etape,
    );
    expect(etapes).toEqual(['contact', 'reponse', 'lecture', 'details', 'long']);
    expect(etatAttente(0, 'pap').progression).toBe(0);
    expect(etatAttente(-5_000, 'pap')).toEqual(etatAttente(0, 'pap'));
  });

  it('la progression ne recule jamais', () => {
    let avant = -1;
    for (let ms = 0; ms <= 120_000; ms += 1_000) {
      const { progression } = etatAttente(ms, 'seloger');
      expect(progression).toBeGreaterThanOrEqual(avant);
      avant = progression;
    }
  });

  it('une durée habituelle par portail, du plus rapide au plus lent', () => {
    for (const portail of PortailSchema.options) {
      expect(DUREES_HABITUELLES_MS[portail]).toBeGreaterThan(0);
    }
    expect(DUREES_HABITUELLES_MS.bienici).toBeLessThan(DUREES_HABITUELLES_MS.seloger);
  });
});

describe('indiceAstuce', () => {
  it('change toutes les 7 secondes et reboucle ; rien à montrer sans astuce', () => {
    expect(indiceAstuce(0, 3)).toBe(0);
    expect(indiceAstuce(INTERVALLE_ASTUCE_MS - 1, 3)).toBe(0);
    expect(indiceAstuce(INTERVALLE_ASTUCE_MS, 3)).toBe(1);
    expect(indiceAstuce(3 * INTERVALLE_ASTUCE_MS, 3)).toBe(0);
    expect(indiceAstuce(-1, 3)).toBe(0);
    expect(indiceAstuce(50_000, 0)).toBe(0);
  });
});

describe('textes de l’attente', () => {
  it('une phrase par étape, avec le nom du portail là où il sert ; des astuces ; les libellés', () => {
    expect(ETAPES_ATTENTE.contact('SeLoger')).toMatch(/SeLoger/);
    expect(ETAPES_ATTENTE.reponse('SeLoger')).toMatch(/SeLoger/);
    expect(ETAPES_ATTENTE.lecture('SeLoger')).toMatch(/prix/);
    expect(ETAPES_ATTENTE.details('SeLoger')).toMatch(/photos/);
    expect(ETAPES_ATTENTE.long('SeLoger')).toMatch(/plus long/);
    expect(ASTUCES_ATTENTE.length).toBeGreaterThanOrEqual(5);
    expect(TEXTES_ATTENTE.titre('PAP')).toBe("Deklic lit l'annonce PAP");
    expect(TEXTES_ATTENTE.ecoule(12)).toBe('12 s');
  });
});
