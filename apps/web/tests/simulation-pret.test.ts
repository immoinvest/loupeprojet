import {
  SimulationPretSchema,
  arrondirCentime,
  calculerProjet,
  obtenirRegles,
  projetExemple,
  simulerPret,
  type ProjetEntree,
} from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import { lienSimulateurPret, simulationDepuisResultats } from '@/analyses';
import {
  CHEMIN_SIMULATEUR,
  decoderSimulation,
  encoderSimulation,
  lireFragmentSimulation,
} from '@/simulateur';
import { decoderJson, encoderJson } from '@/stockage/base64url';

const variante = (hypotheses: Partial<ProjetEntree['hypotheses']>): ProjetEntree => ({
  ...projetExemple,
  hypotheses: { ...projetExemple.hypotheses, ...hypotheses },
});

describe('simulationDepuisResultats', () => {
  const r = calculerProjet(projetExemple);

  it('reprend le prêt du projet dans le format du simulateur (contrat de la fiche 08)', () => {
    expect(simulationDepuisResultats(r)).toEqual({
      versionRegles: '2026-09',
      projet: {
        prix: 155_000,
        honorairesAgence: 7_000,
        travaux: 6_000,
        fraisNotaire: arrondirCentime(r.financement.fraisAcquisition.total),
        departement: '13',
      },
      offres: [
        {
          apport: 14_337,
          fraisDossier: 850,
          fraisGarantie: 1_500,
          fraisBancairesFinances: true,
          tauxNominal: 0.0335,
          tauxAssurance: 0.0025,
          dureeAnnees: 25,
        },
      ],
    });
    expect(SimulationPretSchema.safeParse(simulationDepuisResultats(r)).success).toBe(true);
  });

  it('omet les honoraires à la charge du vendeur, les travaux nuls ; émet les différés non nuls', () => {
    const s = simulationDepuisResultats(
      calculerProjet(
        variante({
          achat: {
            ...projetExemple.hypotheses.achat,
            honorairesChargeAcquereur: false,
            travaux: 0,
          },
          pret: { ...projetExemple.hypotheses.pret, differeTotalMois: 12, differePartielMois: 6 },
        }),
      ),
    );
    expect(s.projet).not.toHaveProperty('honorairesAgence');
    expect(s.projet).not.toHaveProperty('travaux');
    expect(s.offres[0]).toMatchObject({ differeTotalMois: 12, differePartielMois: 6 });
  });
});

describe('lien du simulateur', () => {
  const r = calculerProjet(projetExemple);
  const simulation = simulationDepuisResultats(r);

  it('met la simulation encodée dans le fragment ; le simulateur la relit, défauts complétés', () => {
    const lien = lienSimulateurPret(simulation);
    expect(lien.startsWith(`${CHEMIN_SIMULATEUR}#s=`)).toBe(true);
    const fragment = new URL(lien, 'https://deklic.test').hash;
    expect(lireFragmentSimulation(fragment)).toBe(encoderSimulation(simulation));
    expect(decoderSimulation(lireFragmentSimulation(fragment) ?? '')).toEqual({
      ok: true,
      simulation: SimulationPretSchema.parse(simulation),
    });
    expect(lireFragmentSimulation('#p=autre')).toBeNull();
  });

  it('ouvre, au centime, le prêt du rapport : mêmes mensualité, intérêts et coût total', () => {
    const decodage = decoderSimulation(
      lireFragmentSimulation(lienSimulateurPret(simulation).split('#')[1] ?? '') ?? '',
    );
    expect(decodage.ok).toBe(true);
    if (!decodage.ok) return;
    const [offre] = decodage.simulation.offres;
    if (offre === undefined) throw new Error('offre attendue');
    const resultat = simulerPret(decodage.simulation.projet, offre, obtenirRegles('2026-09'));
    expect(resultat.montantEmprunte).toBeCloseTo(r.financement.montantEmprunte, 2);
    expect(resultat.mensualiteTotale).toBeCloseTo(r.financement.mensualiteTotale, 2);
    expect(resultat.totalInterets).toBeCloseTo(r.financement.totalInterets, 0);
    expect(resultat.coutTotalCredit).toBeCloseTo(r.financement.coutTotalCredit, 0);
  });

  it('refuse proprement un fragment vide, abîmé ou hors contrat', () => {
    expect(decoderSimulation('  ')).toEqual({ ok: false, raison: 'vide' });
    expect(decoderSimulation('%%%')).toEqual({ ok: false, raison: 'illisible' });
    expect(decoderSimulation(encoderJson({ projet: {} }))).toEqual({
      ok: false,
      raison: 'invalide',
    });
    expect(decoderSimulation(encoderJson({ ...simulation, offres: [] }))).toEqual({
      ok: false,
      raison: 'invalide',
    });
  });
});

describe('base64url', () => {
  it('encode un JSON UTF-8 en base64url et le relit ; un texte abîmé rend ok: false', () => {
    const valeur = { nom: 'T3 · 65 m² · Marseille 5e', taux: 0.0335 };
    const texte = encoderJson(valeur);
    expect(texte).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decoderJson(texte)).toEqual({ ok: true, valeur });
    expect(decoderJson('!!!')).toEqual({ ok: false });
    expect(decoderJson(texte.slice(0, -4))).toEqual({ ok: false });
  });
});
