import { obtenirRegles, type SimulationPretEntree } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import {
  CHEMIN_IMPRESSION,
  CHEMIN_SIMULATEUR,
  decoderSimulation,
  encoderSimulation,
  fragmentSimulation,
  lienSimulateur,
  lireFragmentSimulation,
  saisieDefaut,
  versSimulation,
} from '@/simulateur';

const regles = obtenirRegles('2026-09');

const base64url = (texte: string): string =>
  btoa(texte).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('lien du simulateur', () => {
  it('encode une simulation complète et la relit à l’identique', () => {
    const simulation = versSimulation(saisieDefaut(regles)).simulation;
    expect(simulation).not.toBeNull();
    if (simulation === null) return;
    const texte = encoderSimulation(simulation);
    expect(texte).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decoderSimulation(texte)).toEqual({ ok: true, simulation });
    // Deux offres complètes tiennent dans un lien court.
    expect(texte.length).toBeLessThan(700);
  });

  it('complète une simulation partielle par les défauts du schéma (contrat du bouton d’un projet)', () => {
    const partielle: SimulationPretEntree = {
      projet: { prix: 155_000, fraisNotaire: 11_987 },
      offres: [{ tauxNominal: 0.0335, dureeAnnees: 25 }],
    };
    const decodage = decoderSimulation(encoderSimulation(partielle));
    expect(decodage.ok).toBe(true);
    if (!decodage.ok) return;
    expect(decodage.simulation).toEqual({
      versionRegles: '2026-09',
      projet: { prix: 155_000, honorairesAgence: 0, travaux: 0, fraisNotaire: 11_987 },
      offres: [
        {
          nom: '',
          apport: 0,
          fraisDossier: 0,
          fraisGarantie: 0,
          fraisBancairesFinances: false,
          tauxNominal: 0.0335,
          tauxAssurance: 0.0025,
          dureeAnnees: 25,
          differeTotalMois: 0,
          differePartielMois: 0,
        },
      ],
    });
  });

  it('dit pourquoi un lien ne se lit pas, sans jamais lever', () => {
    expect(decoderSimulation('')).toEqual({ ok: false, raison: 'vide' });
    expect(decoderSimulation('   ')).toEqual({ ok: false, raison: 'vide' });
    expect(decoderSimulation('abc')).toEqual({ ok: false, raison: 'illisible' });
    expect(decoderSimulation('%%%')).toEqual({ ok: false, raison: 'illisible' });
    expect(decoderSimulation(base64url('{"projet":1}'))).toEqual({
      ok: false,
      raison: 'invalide',
    });
    // Version de règles inconnue : refusée, la page affichera les défauts.
    expect(
      decoderSimulation(
        base64url(
          JSON.stringify({
            versionRegles: '2031-01',
            projet: { prix: 1, fraisNotaire: 0 },
            offres: [{ tauxNominal: 0.03, dureeAnnees: 20 }],
          }),
        ),
      ),
    ).toEqual({ ok: false, raison: 'invalide' });
    // Valeurs hors bornes (prix de 200 M€, taux 50 %) : refusées aussi.
    expect(
      decoderSimulation(
        base64url(
          JSON.stringify({
            projet: { prix: 200_000_000, fraisNotaire: 0 },
            offres: [{ tauxNominal: 0.5, dureeAnnees: 20 }],
          }),
        ),
      ),
    ).toEqual({ ok: false, raison: 'invalide' });
  });

  it('fabrique le lien et le fragment, et relit le fragment', () => {
    const simulation: SimulationPretEntree = {
      projet: { prix: 100_000, fraisNotaire: 8_000 },
      offres: [{ tauxNominal: 0.03, dureeAnnees: 20 }],
    };
    const fragment = fragmentSimulation(simulation);
    expect(fragment).toBe(`#s=${encoderSimulation(simulation)}`);
    expect(lienSimulateur('https://deklic.app', simulation)).toBe(
      `https://deklic.app/simulateur-pret${fragment}`,
    );
    expect(CHEMIN_SIMULATEUR).toBe('/simulateur-pret');
    expect(CHEMIN_IMPRESSION).toBe('/simulateur-pret/imprimer');
    expect(lireFragmentSimulation(fragment)).toBe(encoderSimulation(simulation));
    expect(lireFragmentSimulation('s=abc')).toBe('abc');
    expect(lireFragmentSimulation('')).toBeNull();
    expect(lireFragmentSimulation('#p=abc')).toBeNull();
  });
});
