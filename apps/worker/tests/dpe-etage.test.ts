import { describe, expect, it } from 'vitest';

import { etageDepuisComplement, SERVICES } from '../src/services';

describe('étage d’un DPE', () => {
  it('lit les formats relevés à Marseille et à Paris (14/09/2026)', () => {
    const cas: [string, number | null][] = [
      ['Rdc', 0],
      ['RdC droite', 0],
      ['Etage RDC; Porte Gauche', 0],
      ['Rez de Chaussée', 0],
      ['Etage 4', 4],
      ['Etage : 1er', 1],
      ['Etage : 3ème', 3],
      ['Étage : 2 ;', 2],
      ['Esc. 2; Etage 1; Porte fond couloir gauche', 1],
      ['Bat. 125; Etage 2; Porte Droite', 2],
      ['BAT RUE - ESC SO - ETG 1 - PORTE GAUCHE', 1],
      ['2ème étage', 2],
      ['1er Etage', 1],
      ['1e étage', 1],
      ['3 ème étage', 3],
      ['5e etage', 5],
      ['Appartement au 3e étage porte de droite + Cave au sous-sol', 3],
      ['Bat cour, 6ème étage gauche', 6],
      ['5eme', 5],
      ['2 ème droite', 2],
      ['A gauche', null],
      ['2 Gauche', null],
      ['1-Bâtiment n°1-1-LogZone', null],
    ];
    for (const [complement, etage] of cas) {
      expect([complement, etageDepuisComplement(complement)]).toEqual([complement, etage]);
    }
    expect(etageDepuisComplement(null)).toBeNull();
  });

  it('le complément fait foi ; sinon un numéro non nul ; le 0 par défaut de la base reste inconnu', () => {
    const ligne = (complement: string | null, numero: number | null | undefined): unknown => ({
      numero_dpe: 'X',
      etiquette_dpe: 'D',
      complement_adresse_logement: complement,
      numero_etage_appartement: numero,
    });
    const r = SERVICES.dpe!.normaliser({
      results: [
        ligne('Etage 3', 0),
        ligne('A gauche', 4),
        ligne(null, 0),
        ligne(null, null),
        ligne(null, undefined),
      ],
    }) as { dpe: { etage: number | null }[] };
    expect(r.dpe.map((d) => d.etage)).toEqual([3, 4, null, null, null]);
  });
});
