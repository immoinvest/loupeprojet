import { describe, expect, it } from 'vitest';

import { resumeDuMois } from '../src/mois';
import { PREFERENCES_PAR_DEFAUT, type EtatGestion } from '../src/schemas';
import { bien, locataire, location, paiement } from './exemples';

const AUJOURDHUI = '2026-09-14';

/** Septembre 2026 de la maquette : Julie et deux chambres de la colocation payées, Antoine en retard. */
const ETAT: EtatGestion = {
  biens: [
    bien('bien-lices', 'T2 Lices'),
    bien('bien-baille', 'Studio Baille'),
    bien('bien-rouet', 'Coloc Rouet'),
  ],
  locataires: [
    locataire('locataire-julie', 'Julie', 'Martin'),
    locataire('locataire-antoine', 'Antoine', 'Dupont'),
    locataire('locataire-lea', 'Léa', 'Bernard'),
    locataire('locataire-hugo', 'Hugo', 'Petit'),
  ],
  locations: [
    location('julie'),
    location('antoine', {
      bienId: 'bien-baille',
      locataireId: 'locataire-antoine',
      jourLoyer: 3,
      loyerHorsCharges: 40_000,
      charges: 3_000,
    }),
    location('lea', {
      bienId: 'bien-rouet',
      locataireId: 'locataire-lea',
      jourLoyer: 1,
      loyerHorsCharges: 45_000,
      charges: 4_000,
    }),
    location('hugo', {
      bienId: 'bien-rouet',
      locataireId: 'locataire-hugo',
      jourLoyer: 1,
      loyerHorsCharges: 45_000,
      charges: 4_000,
    }),
    // Partie en août : aucun loyer en septembre.
    location('ancien', { debut: '2025-01-01', fin: '2026-08-31' }),
    // Arrive en octobre : aucun loyer en septembre.
    location('futur', { debut: '2026-10-01' }),
  ],
  paiements: [
    paiement('p-julie', 'julie', '2026-09', 70_000),
    paiement('p-lea', 'lea', '2026-09', 49_000, '2026-09-01'),
    paiement('p-hugo', 'hugo', '2026-09', 49_000, '2026-09-02'),
    paiement('p-julie-aout', 'julie', '2026-08', 70_000),
  ],
  bailleur: null,
  documents: [],
  preferences: PREFERENCES_PAR_DEFAUT,
};

describe('resumeDuMois', () => {
  it('« 3 loyers sur 4 reçus » : totaux, retards, lignes avec bien et locataire', () => {
    const resume = resumeDuMois(ETAT, '2026-09', AUJOURDHUI);
    expect(resume).toMatchObject({
      periode: '2026-09',
      nombreRecus: 3,
      nombreEnRetard: 1,
      montantRecu: 168_000,
      montantDu: 211_000,
    });
    expect(resume.lignes).toHaveLength(4);
    const [premiere] = resume.lignes;
    expect(premiere?.statut).toBe('en_retard');
    expect(premiere?.bien?.nom).toBe('Studio Baille');
    expect(premiere?.locataire?.prenom).toBe('Antoine');
    expect(premiere?.paiements).toEqual([]);
  });

  it('trie : en retard, attendus, à venir, reçus ; puis par date due, puis par bien', () => {
    const etat: EtatGestion = {
      ...ETAT,
      locations: [
        ...ETAT.locations,
        location('attendu', { bienId: 'bien-lices', jourLoyer: 12 }),
        location('a-venir', { bienId: 'bien-baille', debut: '2026-09-20' }),
      ],
    };
    const lignes = resumeDuMois(etat, '2026-09', AUJOURDHUI).lignes;
    expect(lignes.map((l) => `${l.location.id} ${l.statut}`)).toEqual([
      'antoine en_retard',
      'attendu attendu',
      'a-venir a_venir',
      // Reçus : Léa et Hugo dus le 1er (Coloc Rouet, deux fois), Julie le 5.
      'lea recu',
      'hugo recu',
      'julie recu',
    ]);
  });

  it('un loyer partiel se range entre les retards et les attendus, avec son reste dû', () => {
    const etat: EtatGestion = {
      ...ETAT,
      locations: [...ETAT.locations, location('retard', { bienId: 'bien-lices', jourLoyer: 2 })],
      paiements: [
        ...ETAT.paiements,
        paiement('p-antoine', 'antoine', '2026-09', 20_000, '2026-09-04'),
      ],
    };
    const resume = resumeDuMois(etat, '2026-09', AUJOURDHUI);
    expect(resume.lignes.map((l) => `${l.location.id} ${l.statut}`)).toEqual([
      'retard en_retard',
      'antoine partiel',
      'lea recu',
      'hugo recu',
      'julie recu',
    ]);
    expect(resume.lignes[1]?.resteDu).toBe(23_000);
    expect(resume).toMatchObject({
      nombreRecus: 3,
      nombreEnRetard: 1,
      montantRecu: 188_000,
      montantDu: 281_000,
    });
  });

  it('à date due égale, le bien départage ; un bien inconnu passe en premier', () => {
    const etat: EtatGestion = {
      ...ETAT,
      paiements: [],
      locations: [
        location('z', { bienId: 'bien-rouet' }),
        location('a', { bienId: 'bien-lices' }),
        location('orphelin', { bienId: 'disparu', locataireId: 'disparu' }),
      ],
    };
    const lignes = resumeDuMois(etat, '2026-09', AUJOURDHUI).lignes;
    expect(lignes.map((l) => l.location.id)).toEqual(['orphelin', 'z', 'a']);
    expect(lignes[0]?.bien).toBeUndefined();
    expect(lignes[0]?.locataire).toBeUndefined();
  });

  it('colocation et chambres : colocataires retrouvés dans l’ordre ; le bien entier, puis ses chambres', () => {
    const etat: EtatGestion = {
      ...ETAT,
      paiements: [],
      locations: [
        location('chambre-10', {
          bienId: 'bien-rouet',
          locataireId: 'locataire-hugo',
          libelle: 'Chambre 10',
        }),
        location('chambre-2', {
          bienId: 'bien-rouet',
          locataireId: 'locataire-lea',
          libelle: 'Chambre 2',
        }),
        location('coloc', {
          bienId: 'bien-rouet',
          locataireId: 'locataire-julie',
          colocataireIds: ['locataire-antoine', 'disparu', 'locataire-lea'],
        }),
      ],
    };
    const lignes = resumeDuMois(etat, '2026-09', AUJOURDHUI).lignes;
    expect(lignes.map((l) => l.location.id)).toEqual(['coloc', 'chambre-2', 'chambre-10']);
    expect(lignes[0]?.locataire?.prenom).toBe('Julie');
    // Un colocataire introuvable (données incohérentes) est ignoré.
    expect(lignes[0]?.colocataires.map((l) => l.prenom)).toEqual(['Antoine', 'Léa']);
    expect(lignes[1]?.colocataires).toEqual([]);
  });

  it('un trop-perçu ne gonfle pas le mois', () => {
    const etat: EtatGestion = {
      ...ETAT,
      locations: [location('julie')],
      paiements: [paiement('p', 'julie', '2026-09', 80_000)],
    };
    expect(resumeDuMois(etat, '2026-09', AUJOURDHUI)).toMatchObject({
      montantRecu: 70_000,
      montantDu: 70_000,
      nombreRecus: 1,
    });
  });

  it('aucune location : un mois vide', () => {
    expect(
      resumeDuMois(
        { biens: [], locataires: [], locations: [], paiements: [] },
        '2026-09',
        AUJOURDHUI,
      ),
    ).toEqual({
      periode: '2026-09',
      lignes: [],
      nombreRecus: 0,
      nombreEnRetard: 0,
      montantRecu: 0,
      montantDu: 0,
    });
  });
});
