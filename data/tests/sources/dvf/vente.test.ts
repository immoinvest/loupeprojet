import { beforeAll, describe, expect, it } from 'vitest';
import { lireCsv, type EnregistrementCsv } from '../../../src/commun/csv.ts';
import { collecter, depuisMorceaux } from '../../../src/commun/flux.ts';
import { FILTRES_DVF } from '../../../src/sources/dvf/constantes.ts';
import { regrouperParMutation } from '../../../src/sources/dvf/mutations.ts';
import { venteDepuisMutation, type ResultatVente } from '../../../src/sources/dvf/vente.ts';
import { lireFixture } from '../../aides/faux-contexte.ts';

const mutations = new Map<string, readonly EnregistrementCsv[]>();

beforeAll(async () => {
  const texte = (await lireFixture('dvf/2A-2025.csv')).toString('utf8');
  const groupes = await collecter(
    regrouperParMutation(lireCsv(depuisMorceaux([texte]), { separateur: ',' })),
  );
  for (const groupe of groupes) {
    if (!groupe.rupture) {
      mutations.set(groupe.id, groupe.lignes);
    }
  }
});

function analyser(id: string): ResultatVente {
  const lignes = mutations.get(id);
  if (lignes === undefined) {
    throw new Error(`mutation ${id} absente de la fixture`);
  }
  return venteDepuisMutation(lignes, FILTRES_DVF);
}

function motif(id: string): string {
  const resultat = analyser(id);
  return resultat.ok ? 'ok' : resultat.motif;
}

describe('venteDepuisMutation', () => {
  it('retient une maison seule avec ses coordonnées, sa parcelle et son adresse', () => {
    expect(analyser('2025-327551')).toEqual({
      ok: true,
      vente: {
        codeCommune: '2A062',
        vente: {
          date: '2025-01-02',
          prix: 311610,
          surface: 118,
          type: 'maison',
          pieces: 4,
          lat: 42.038082,
          lon: 8.949341,
          idParcelle: '2A0620000B1203',
          numero: 5011,
          suffixe: null,
          codeVoie: 'B180',
          voie: 'SAINT SYLVESTRE',
          carrez: null,
          dependances: 0,
          terrain: 1001,
          lots: null,
        },
      },
    });
  });

  it('retient un appartement vendu avec une dépendance, sans compter la dépendance dans la surface', () => {
    const resultat = analyser('2025-327560');
    expect(resultat.ok && resultat.vente.vente).toMatchObject({
      type: 'appartement',
      surface: 66,
      prix: 136000,
      pieces: 4,
      idParcelle: '2A004000BO0412',
      codeVoie: 'A090',
      carrez: 67.09,
      dependances: 1,
      terrain: null,
      lots: 1,
    });
  });

  it('additionne une fois le terrain de chaque parcelle et nature de culture, compte les dépendances distinctes', () => {
    const base = mutations.get('2025-327551');
    if (base === undefined) {
      throw new Error('fixture incomplète');
    }
    const maison = base[0] as Record<string, string>;
    const sol = {
      ...maison,
      code_type_local: '',
      type_local: '',
      surface_reelle_bati: '',
      nombre_pieces_principales: '',
    };
    const cave = { ...sol, code_type_local: '3', type_local: 'Dépendance', surface_terrain: '' };
    const resultat = venteDepuisMutation(
      [
        maison,
        sol, // même parcelle, même culture que la maison : 1 001 m² comptés une fois
        { ...sol, code_nature_culture: 'AG', surface_terrain: '250' },
        { ...sol, id_parcelle: '2A0620000B1204', surface_terrain: '99.5' },
        cave,
        { ...cave, id_parcelle: '2A0620000B1204' },
        cave,
      ],
      FILTRES_DVF,
    );
    expect(resultat.ok && resultat.vente.vente).toMatchObject({
      terrain: 1350.5,
      dependances: 2,
    });
    const sansTerrain = venteDepuisMutation(
      [{ ...maison, surface_terrain: '', nombre_lots: '3' }],
      FILTRES_DVF,
    );
    expect(sansTerrain.ok && sansTerrain.vente.vente).toMatchObject({ terrain: null, lots: 3 });
  });

  it("ne compte qu'une fois un local répété à l'identique sur plusieurs lignes", () => {
    const resultat = analyser('2025-327695');
    expect(resultat.ok && resultat.vente).toMatchObject({
      codeCommune: '2A065',
      vente: { type: 'appartement', surface: 46, prix: 175000, pieces: 3 },
    });
  });

  it('garde une vente sans coordonnées ni nombre de pièces, avec des valeurs nulles ou zéro', () => {
    const resultat = analyser('2025-900001');
    expect(resultat.ok && resultat.vente.vente).toMatchObject({ lat: null, lon: null, pieces: 0 });
  });

  it('écarte les mutations qui ne sont pas des ventes', () => {
    expect(motif('2025-327596')).toBe('nature'); // échange
    expect(motif('2025-327847')).toBe('nature'); // vente en l'état futur d'achèvement
    expect(motif('2025-327854')).toBe('nature'); // terrain à bâtir
  });

  it('écarte les mutations sans logement, à plusieurs logements ou avec un local commercial', () => {
    expect(motif('2025-327550')).toBe('logements'); // parcelle nue
    expect(motif('2025-900004')).toBe('logements'); // deux appartements différents
    expect(motif('2025-328104')).toBe('local_commercial');
  });

  it('écarte les prix ambigus ou absents, les surfaces et prix au m² hors bornes', () => {
    expect(motif('2025-900002')).toBe('prix'); // deux dispositions, deux valeurs
    expect(motif('2025-900006')).toBe('prix'); // valeur foncière vide
    expect(motif('2025-900003')).toBe('surface'); // 8 m²
    expect(motif('2025-327721')).toBe('prix_m2'); // 147 €/m²
  });

  it('applique les bornes hautes et refuse une date mal formée', () => {
    const base = mutations.get('2025-327563');
    if (base === undefined) {
      throw new Error('fixture incomplète');
    }
    const ligne = base[0] as Record<string, string>;
    const avec = (modifications: Record<string, string>): ResultatVente =>
      venteDepuisMutation([{ ...ligne, ...modifications }], FILTRES_DVF);
    expect(avec({ surface_reelle_bati: '2000', valeur_fonciere: '1000000' })).toMatchObject({
      motif: 'surface',
    });
    expect(avec({ valeur_fonciere: '9000000' })).toMatchObject({ motif: 'prix_m2' });
    expect(avec({ date_mutation: '13/01/2025' })).toMatchObject({ motif: 'date' });
    expect(avec({ nombre_pieces_principales: '' })).toMatchObject({
      ok: true,
      vente: { vente: { pieces: 0 } },
    });
    expect(avec({ adresse_numero: '', adresse_nom_voie: '  ' })).toMatchObject({
      ok: true,
      vente: { vente: { numero: null, voie: null } },
    });
  });
});
