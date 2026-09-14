import { obtenirRegles } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import {
  CLE_SIMULATEUR,
  appliquerTexte,
  calculer,
  ecrireSimulation,
  etatInitial,
  fragmentSimulation,
  retirerOffreB,
  saisieDefaut,
  versSimulation,
} from '@/simulateur';

const regles = obtenirRegles('2026-09');

describe('calculer', () => {
  const s = appliquerTexte(saisieDefaut(regles), regles, 'a', 'nom', 'LCL');

  it('simule les deux offres et les compare', () => {
    const c = calculer(s, regles);
    expect(c.saisie).toBe(s);
    expect(c.conversion.simulation).not.toBeNull();
    expect(c.resultats[0]?.montantEmprunte).toBeGreaterThan(150_000);
    expect(c.resultats[1]?.montantEmprunte).toBe(c.resultats[0]?.montantEmprunte);
    expect(c.comparaison?.criteres).toHaveLength(9);
    expect(c.noms).toEqual(['LCL', 'Offre B']);
  });

  it('calcule A seule quand B est absente ou fausse, rien quand le projet est faux', () => {
    const sansB = calculer(retirerOffreB(s), regles);
    expect(sansB.resultats[1]).toBeNull();
    expect(sansB.comparaison).toBeNull();
    expect(sansB.noms).toEqual(['LCL', 'Offre B']);

    const bFausse = calculer(appliquerTexte(s, regles, 'b', 'tauxNominal', 'x'), regles);
    expect(bFausse.resultats[0]).not.toBeNull();
    expect(bFausse.resultats[1]).toBeNull();
    expect(bFausse.comparaison).toBeNull();

    const aFausse = calculer(appliquerTexte(s, regles, 'a', 'dureeAnnees', ''), regles);
    expect(aFausse.resultats).toEqual([null, expect.anything()]);
    expect(aFausse.comparaison).toBeNull();

    const projetFaux = calculer(appliquerTexte(s, regles, 'projet', 'prix', 'abc'), regles);
    expect(projetFaux.resultats).toEqual([null, null]);
    expect(projetFaux.comparaison).toBeNull();
  });
});

describe('etatInitial', () => {
  const simulation = versSimulation(
    appliquerTexte(saisieDefaut(regles), regles, 'a', 'nom', 'CIC'),
  ).simulation;
  if (simulation === null) throw new Error('simulation attendue');

  it('lit le fragment du lien, à enregistrer tout de suite', () => {
    const etat = etatInitial(fragmentSimulation(simulation), window.localStorage, regles);
    expect(etat.saisie.offres[0].nom).toBe('CIC');
    expect(etat.lienIllisible).toBe(false);
    expect(etat.aEnregistrer).toBe(true);
  });

  it('un fragment illisible donne les défauts, signalés, sans rien enregistrer', () => {
    ecrireSimulation(window.localStorage, simulation);
    const etat = etatInitial('#s=abc', window.localStorage, regles);
    expect(etat.saisie).toEqual(saisieDefaut(regles));
    expect(etat.lienIllisible).toBe(true);
    expect(etat.aEnregistrer).toBe(false);
  });

  it('sans fragment, retrouve la dernière simulation, sinon les défauts', () => {
    expect(etatInitial('', window.localStorage, regles)).toEqual({
      saisie: saisieDefaut(regles),
      lienIllisible: false,
      aEnregistrer: false,
    });
    ecrireSimulation(window.localStorage, simulation);
    const etat = etatInitial('#autre=1', window.localStorage, regles);
    expect(etat.saisie.offres[0].nom).toBe('CIC');
    expect(etat.aEnregistrer).toBe(true);
    expect(window.localStorage.getItem(CLE_SIMULATEUR)).not.toBeNull();
  });
});
