import { describe, expect, it } from 'vitest';

import { obtenirRegles } from '../../src/regles';
import { LocationSchema } from '../../src/schema';

const regles = obtenirRegles('2026-09');
const { parType } = regles.exploitation;

describe('règles 2026-09 — types d’exploitation', () => {
  it('les défauts du schéma sont ceux des règles (vacance, séjours)', () => {
    expect(LocationSchema.parse({ mode: 'nu', loyerHc: 1 })).toMatchObject({
      vacanceSemaines: parType.nu.vacanceSemaines,
    });
    expect(LocationSchema.parse({ mode: 'meuble', loyerHc: 1 })).toMatchObject({
      vacanceSemaines: parType.meuble.vacanceSemaines,
    });
    expect(
      LocationSchema.parse({ mode: 'colocation', chambres: 1, loyerChambre: 1 }),
    ).toMatchObject({ vacanceSemaines: parType.colocation.vacanceSemaines });
    const cd = LocationSchema.parse({ mode: 'courte_duree', nuitee: 1, nuiteesParMois: 1 });
    expect(cd.mode === 'courte_duree' && cd.dureeSejourNuits).toBe(
      parType.courte_duree.dureeSejourNuits,
    );
    const md = LocationSchema.parse({ mode: 'moyenne_duree', loyerHc: 1 });
    expect(md.mode === 'moyenne_duree' && md.dureeSejourMois).toBe(
      parType.moyenne_duree.dureeSejourMois,
    );
    expect(md.mode === 'moyenne_duree' && md.vacanceSemaines).toBe(
      parType.moyenne_duree.vacanceSemaines,
    );
  });

  it('marque à confirmer les valeurs venues de l’Excel ou de choix Deklic', () => {
    for (const chemin of [
      'exploitation.parType.courte_duree.nuiteesParMois',
      'exploitation.parType.courte_duree.plateformeTaux',
      'exploitation.parType.colocation.energieMensuel',
      'exploitation.parType.moyenne_duree.vacanceSemaines',
    ]) {
      expect(regles.aConfirmer).toContain(chemin);
    }
  });

  it('porte la réglementation sourcée : décence, meublés de tourisme, bail mobilité', () => {
    expect(regles.exploitation.colocation).toEqual({
      surfaceMinChambreM2: 9,
      volumeMinChambreM3: 20,
    });
    expect(regles.exploitation.meubleTourisme).toMatchObject({
      dpeMinNouvelleAutorisation: 'E',
      dpeMinTous: 'D',
      dpeMinTousDes: 2034,
      joursMaxResidencePrincipale: 120,
    });
    expect(regles.exploitation.bailMobilite).toEqual({ dureeMinMois: 1, dureeMaxMois: 10 });
    expect(regles.fiscalite.microBic.abattementTourismeNonClasse).toBe(0.3);
    expect(regles.fiscalite.microBic.plafondTourismeNonClasse).toBe(15_000);
  });
});
