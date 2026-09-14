import { describe, expect, it } from 'vitest';

import { dateEnLettres, leJour, leJourDuMois, moisEnLettres, montant } from '@/gestion/format';
import {
  basculer,
  CLE_MENU,
  ecrirePreferencesLocales,
  estFigee,
  lirePreferencesLocales,
  retardsDuMois,
  sectionsAffichees,
} from '@/gestion/menu';
import type { CodeErreurGestion } from '@/gestion/types';
import { ERREURS_GESTION, loyersEnRetard, tousMesProjets } from '@/textes/gerer';

import { ETAT_SEPTEMBRE, STOCKAGE_EN_PANNE } from './gestion-exemples';

const ANALYSER_MASQUE = { analyser: false, gerer: true };

/** Intl met des espaces insécables (fines ou non) : on les compare comme des espaces. */
function espaces(texte: string): string {
  return texte.replace(/\s/g, ' ');
}

describe('sections du menu', () => {
  it('sans compte, les deux sections ; sinon les préférences', () => {
    expect(sectionsAffichees('anonyme', ANALYSER_MASQUE)).toEqual({ analyser: true, gerer: true });
    expect(sectionsAffichees('connecte', ANALYSER_MASQUE)).toEqual(ANALYSER_MASQUE);
    expect(sectionsAffichees('chargement', ANALYSER_MASQUE)).toEqual(ANALYSER_MASQUE);
  });

  it('basculer inverse une section, jamais les deux ; la dernière est figée', () => {
    expect(basculer({ analyser: true, gerer: true }, 'analyser')).toEqual(ANALYSER_MASQUE);
    expect(basculer(ANALYSER_MASQUE, 'analyser')).toEqual({ analyser: true, gerer: true });
    expect(basculer(ANALYSER_MASQUE, 'gerer')).toBeNull();
    expect(estFigee(ANALYSER_MASQUE, 'gerer')).toBe(true);
    expect(estFigee(ANALYSER_MASQUE, 'analyser')).toBe(false);
  });

  it('préférences locales : absentes, abîmées, invalides ou valides', () => {
    const stockage = window.localStorage;
    expect(lirePreferencesLocales(stockage)).toBeNull();
    stockage.setItem(CLE_MENU, '{"analyser": ');
    expect(lirePreferencesLocales(stockage)).toBeNull();
    stockage.setItem(CLE_MENU, JSON.stringify({ analyser: false, gerer: false }));
    expect(lirePreferencesLocales(stockage)).toBeNull();
    ecrirePreferencesLocales(stockage, ANALYSER_MASQUE);
    expect(lirePreferencesLocales(stockage)).toEqual(ANALYSER_MASQUE);
  });

  it('un stockage en panne ne fait jamais échouer le menu', () => {
    expect(lirePreferencesLocales(STOCKAGE_EN_PANNE)).toBeNull();
    expect(() => {
      ecrirePreferencesLocales(STOCKAGE_EN_PANNE, ANALYSER_MASQUE);
    }).not.toThrow();
  });

  it('retardsDuMois compte les loyers en retard du mois du jour', () => {
    expect(retardsDuMois(null, '2026-09-14')).toBe(0);
    expect(retardsDuMois(ETAT_SEPTEMBRE, '2026-09-14')).toBe(1);
    expect(retardsDuMois(ETAT_SEPTEMBRE, '2026-09-04')).toBe(0);
  });
});

describe('format des montants et des dates', () => {
  it('montant : centimes seulement quand il y en a', () => {
    expect(espaces(montant(65_000))).toBe('650 €');
    expect(espaces(montant(65_050))).toBe('650,50 €');
    expect(espaces(montant(130_000))).toBe('1 300 €');
    expect(espaces(montant(0))).toBe('0 €');
  });

  it('mois en lettres et jour du mois', () => {
    expect(moisEnLettres('2026-09')).toBe('septembre 2026');
    expect(moisEnLettres('2027-01')).toBe('janvier 2027');
    expect(leJour('2026-10-01')).toBe('le 1er');
    expect(leJour('2026-10-05')).toBe('le 5');
    expect(leJour('2026-10-28')).toBe('le 28');
    expect(leJourDuMois(1)).toBe('le 1er');
    expect(leJourDuMois(15)).toBe('le 15');
    expect(dateEnLettres('2026-10-01')).toBe('1er octobre 2026');
    expect(dateEnLettres('2027-01-12')).toBe('12 janvier 2027');
  });
});

describe('textes de Gérer', () => {
  it('pluriels et compteurs', () => {
    expect(tousMesProjets(8)).toBe('Tous mes projets · 8');
    expect(loyersEnRetard(1)).toBe('1 loyer en retard');
    expect(loyersEnRetard(3)).toBe('3 loyers en retard');
  });

  it('une phrase pour chaque code d’erreur', () => {
    const codes: CodeErreurGestion[] = [
      'non_connecte',
      'invalide',
      'introuvable',
      'deja_recu',
      'indisponible',
      'reseau',
      'inconnue',
    ];
    for (const code of codes) expect(ERREURS_GESTION[code].length).toBeGreaterThan(10);
  });
});
