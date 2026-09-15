import type { EtatGestion, Locataire, LocationGeree } from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import { friseDuBien } from '@/gestion/fiche';
import { ficheDuLocataire } from '@/gestion/fiche-locataire';
import { ETATS_OCCUPATION, TONS_OCCUPATION } from '@/textes/gerer-locataire';

import {
  ANTOINE,
  BIEN_BAILLE,
  BIEN_LICES,
  ETAT_SEPTEMBRE,
  HORODATAGE,
  JULIE,
  LOCATION_ANTOINE,
  LOCATION_JULIE,
} from './gestion-exemples';

const AUJOURDHUI = '2026-09-14';

const LEA: Locataire = { id: 'locataire-lea', prenom: 'Léa', nom: 'Bernard', creeLe: HORODATAGE };

describe('ficheDuLocataire', () => {
  it('locataire inconnu : aucune fiche', () => {
    expect(ficheDuLocataire(ETAT_SEPTEMBRE, 'inconnu', AUJOURDHUI)).toBeNull();
  });

  it('Julie : une location en cours, montants de ce mois, les douze loyers de son bien', () => {
    const fiche = ficheDuLocataire(ETAT_SEPTEMBRE, JULIE.id, AUJOURDHUI);
    expect(fiche?.locataire).toEqual(JULIE);
    expect(fiche?.occupations).toHaveLength(1);
    expect(fiche?.occupations[0]).toMatchObject({
      location: LOCATION_JULIE,
      bien: BIEN_LICES,
      etat: 'en_cours',
      colocataires: [],
    });
    expect(fiche?.occupations[0]?.montants).toMatchObject({
      loyerHorsCharges: 65_000,
      charges: 5_000,
      apl: 0,
    });
    expect(fiche?.loyers).toHaveLength(12);
    expect(fiche?.loyers.at(-1)).toMatchObject({ periode: '2026-09', statut: 'recu' });
    // Un seul bail : la même frise que la fiche du bien.
    expect(fiche?.loyers).toEqual(friseDuBien(ETAT_SEPTEMBRE, BIEN_LICES.id, AUJOURDHUI));
  });

  it('Léa : à venir et en cours d’abord, puis terminée ; montants du bon mois ; mois sans loyer retirés', () => {
    const aVenir: LocationGeree = {
      ...LOCATION_JULIE,
      id: 'loc-a-venir',
      colocataireIds: [LEA.id, ANTOINE.id],
      debut: '2026-10-01',
      changements: [{ aPartirDe: '2026-10', loyerHorsCharges: 66_000, charges: 5_000, apl: 0 }],
    };
    const enCours: LocationGeree = {
      ...LOCATION_JULIE,
      id: 'loc-en-cours',
      bienId: BIEN_BAILLE.id,
      locataireId: LEA.id,
      libelle: 'Chambre 2',
      debut: '2026-07-01',
    };
    const terminee: LocationGeree = {
      ...LOCATION_ANTOINE,
      id: 'loc-terminee',
      locataireId: LEA.id,
      debut: '2026-01-01',
      fin: '2026-06-30',
      changements: [
        { aPartirDe: '2026-03', loyerHorsCharges: 42_000, charges: 3_000, apl: 5_000 },
        // Après la sortie : ne doit pas compter pour les derniers montants.
        { aPartirDe: '2026-08', loyerHorsCharges: 99_000, charges: 3_000, apl: 0 },
      ],
    };
    const donnees: EtatGestion = {
      ...ETAT_SEPTEMBRE,
      locataires: [JULIE, ANTOINE, LEA],
      locations: [terminee, aVenir, LOCATION_JULIE, enCours, LOCATION_ANTOINE],
    };

    const fiche = ficheDuLocataire(donnees, LEA.id, AUJOURDHUI);
    expect(fiche?.occupations.map((o) => [o.location.id, o.etat])).toEqual([
      ['loc-a-venir', 'a_venir'],
      ['loc-en-cours', 'en_cours'],
      ['loc-terminee', 'terminee'],
    ]);
    const [avenir, encours, finie] = fiche?.occupations ?? [];
    // Le titulaire puis les autres colocataires, sans Léa.
    expect(avenir?.colocataires).toEqual([JULIE, ANTOINE]);
    // Montants du mois d'entrée.
    expect(avenir?.montants).toMatchObject({ loyerHorsCharges: 66_000 });
    expect(encours?.bien).toEqual(BIEN_BAILLE);
    expect(encours?.colocataires).toEqual([]);
    // Montants du dernier mois occupé (juin 2026).
    expect(finie?.montants).toMatchObject({ loyerHorsCharges: 42_000, charges: 3_000, apl: 5_000 });

    // Octobre à décembre 2025 : aucun loyer dû par Léa. Janvier à septembre 2026 : neuf mois.
    expect(fiche?.loyers.map((m) => m.periode)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
    // Seules les locations de Léa comptent, pas celle d'Antoine sur le même bien.
    expect(
      fiche?.loyers.every((m) => m.lignes.every((l) => l.location.id !== 'location-antoine')),
    ).toBe(true);
  });

  it('le bien d’une location a disparu : pas de carte pour elle', () => {
    const donnees: EtatGestion = {
      ...ETAT_SEPTEMBRE,
      locations: [{ ...LOCATION_JULIE, bienId: 'disparu' }],
    };
    expect(ficheDuLocataire(donnees, JULIE.id, AUJOURDHUI)?.occupations).toEqual([]);
  });

  it('textes des états', () => {
    expect(ETATS_OCCUPATION).toEqual({
      en_cours: 'En cours',
      a_venir: 'À venir',
      terminee: 'Terminée',
    });
    expect(TONS_OCCUPATION).toEqual({ en_cours: 'bon', a_venir: 'accent', terminee: 'neutre' });
  });
});
