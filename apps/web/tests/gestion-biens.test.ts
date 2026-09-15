import type { BienGere, EtatGestion } from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import { resumeDesBiens } from '@/gestion/biens';
import { montant } from '@/gestion/format';
import { mesBiens } from '@/textes/gerer';
import { loyerParMois, nombreDeBiens, occupantsDuBien } from '@/textes/gerer-biens';
import { nomsDesLocataires } from '@/textes/gerer-loyers';

import {
  ANTOINE,
  BIEN_BAILLE,
  BIEN_LICES,
  ETAT_SEPTEMBRE,
  JULIE,
  LOCATION_ANTOINE,
  LOCATION_JULIE,
} from './gestion-exemples';

const AUJOURDHUI = '2026-09-14';

function bien(id: string, nom: string): BienGere {
  return { ...BIEN_LICES, id, nom };
}

describe('resumeDesBiens', () => {
  it('une ligne par bien, triée par nom : état, locataires, loyer en vigueur, loyer du mois', () => {
    const [baille, lices] = resumeDesBiens(ETAT_SEPTEMBRE, AUJOURDHUI);
    expect(baille).toMatchObject({
      bien: BIEN_BAILLE,
      etat: { statut: 'loue' },
      aVenir: false,
      locations: 1,
      locataires: [ANTOINE],
      loyerMensuel: 43_000,
      statutDuMois: 'en_retard',
    });
    expect(lices).toMatchObject({
      locataires: [JULIE],
      loyerMensuel: 70_000,
      statutDuMois: 'recu',
    });
  });

  it('à la chambre, colocation, changement de loyer, vacant, entrée à venir ; ordre naturel', () => {
    const donnees: EtatGestion = {
      ...ETAT_SEPTEMBRE,
      biens: [
        bien('b10', 'Coloc 10'),
        bien('b2', 'Coloc 2'),
        bien('b-parking', 'Parking'),
        bien('b-neuf', 'Studio neuf'),
      ],
      locations: [
        {
          ...LOCATION_JULIE,
          id: 'chambre-1',
          bienId: 'b2',
          libelle: 'Chambre 1',
          colocataireIds: [ANTOINE.id],
          changements: [{ aPartirDe: '2026-09', loyerHorsCharges: 50_000, charges: 5_000, apl: 0 }],
        },
        { ...LOCATION_ANTOINE, id: 'chambre-2', bienId: 'b2', libelle: 'Chambre 2' },
        { ...LOCATION_JULIE, id: 'neuf', bienId: 'b-neuf', debut: '2026-10-01' },
        {
          ...LOCATION_JULIE,
          id: 'ancienne',
          bienId: 'b10',
          debut: '2024-01-01',
          fin: '2025-01-31',
        },
      ],
      paiements: [],
    };
    const resumes = resumeDesBiens(donnees, AUJOURDHUI);
    expect(resumes.map((r) => r.bien.nom)).toEqual([
      'Coloc 2',
      'Coloc 10',
      'Parking',
      'Studio neuf',
    ]);
    const [coloc2, coloc10, parking, neuf] = resumes;
    expect(coloc2).toMatchObject({
      locations: 2,
      locataires: [JULIE, ANTOINE],
      loyerMensuel: 55_000 + 43_000,
      statutDuMois: 'en_retard',
    });
    expect(coloc10).toMatchObject({
      etat: { statut: 'vacant' },
      locations: 0,
      locataires: [],
      loyerMensuel: 0,
      statutDuMois: null,
    });
    expect(parking?.statutDuMois).toBeNull();
    expect(neuf).toMatchObject({
      etat: { statut: 'a_venir' },
      aVenir: true,
      locations: 1,
      locataires: [JULIE],
      loyerMensuel: 70_000,
      statutDuMois: null,
    });
  });
});

describe('textes de Mes biens', () => {
  it('titre, entrée du menu, occupants et loyer', () => {
    expect(nombreDeBiens(1)).toBe('1 bien');
    expect(nombreDeBiens(4)).toBe('4 biens');
    expect(mesBiens(null)).toBe('Mes biens');
    expect(mesBiens(3)).toBe('Mes biens · 3');
    expect(occupantsDuBien([], 0, false)).toBe('Sans locataire');
    expect(occupantsDuBien(['Julie Martin'], 1, false)).toBe('Julie Martin');
    const colocation = ['Julie Martin', 'Léa Bernard'];
    expect(occupantsDuBien(colocation, 1, false)).toBe(nomsDesLocataires(colocation));
    expect(occupantsDuBien(colocation, 2, false)).toBe('2 locations en cours');
    expect(occupantsDuBien(colocation, 2, true)).toBe('2 locations à venir');
    expect(loyerParMois(70_000)).toBe(`${montant(70_000)} par mois`);
  });
});
