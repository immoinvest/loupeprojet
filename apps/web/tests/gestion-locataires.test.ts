import type { EtatGestion, Locataire } from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import { groupesDeLocataires, locataireDepuisSaisie, saisieLocataire } from '@/gestion/locataires';
import { clientGestionMemoire } from '@/gestion/memoire';
import {
  ERREURS_LOCATAIRE,
  nombreDeLocataires,
  periodeDuLocataire,
} from '@/textes/gerer-locataires';

import {
  ANTOINE,
  BIEN_LICES,
  ETAT_SEPTEMBRE,
  HORODATAGE,
  JULIE,
  LOCATION_ANTOINE,
  LOCATION_JULIE,
} from './gestion-exemples';

const AUJOURDHUI = '2026-09-14';

function locataire(id: string, prenom: string, nom: string): Locataire {
  return { id, prenom, nom, creeLe: HORODATAGE };
}

describe('groupesDeLocataires', () => {
  it('en ce moment (en cours ou à venir) puis anciens ; colocataires ; plusieurs locations ; tri par nom puis prénom', () => {
    const LEA = locataire('locataire-lea', 'Léa', 'Bernard');
    const PAUL = locataire('locataire-paul', 'Paul', 'Martin');
    const HUGO = locataire('locataire-hugo', 'Hugo', 'Petit');
    const donnees: EtatGestion = {
      ...ETAT_SEPTEMBRE,
      locataires: [PAUL, JULIE, ANTOINE, LEA, HUGO],
      locations: [
        { ...LOCATION_JULIE, colocataireIds: [LEA.id] },
        { ...LOCATION_ANTOINE, fin: '2026-08-31' },
        {
          ...LOCATION_ANTOINE,
          id: 'antoine-avant',
          bienId: 'bien-lices',
          debut: '2024-01-01',
          fin: '2024-12-31',
        },
        {
          ...LOCATION_JULIE,
          id: 'lea-bientot',
          locataireId: LEA.id,
          bienId: 'bien-baille',
          debut: '2026-10-01',
          fin: '2027-09-30',
        },
        { ...LOCATION_JULIE, id: 'paul', locataireId: PAUL.id, fin: '2026-12-31' },
      ],
    };
    const { enCeMoment, anciens } = groupesDeLocataires(donnees, AUJOURDHUI);
    // Hugo n'a aucune location : il n'apparaît pas.
    expect(enCeMoment.map((l) => `${l.locataire.prenom} ${l.locataire.nom}`)).toEqual([
      'Léa Bernard',
      'Julie Martin',
      'Paul Martin',
    ]);
    const [lea, julie, paul] = enCeMoment;
    expect(lea?.occupations.map((o) => o.location.id)).toEqual(['location-julie', 'lea-bientot']);
    expect(lea).toMatchObject({ entree: '2025-10-01' });
    expect(lea).not.toHaveProperty('sortie');
    expect(julie?.occupations[0]?.bien).toEqual(BIEN_LICES);
    expect(paul).toMatchObject({ sortie: '2026-12-31' });
    expect(anciens).toEqual([
      expect.objectContaining({ locataire: ANTOINE, entree: '2024-01-01', sortie: '2026-08-31' }),
    ]);
  });
});

describe('saisie et client mémoire du locataire', () => {
  it('prérempli, lu comme à la création, champs à corriger', () => {
    expect(saisieLocataire(JULIE)).toEqual({
      locataire: 'Julie Martin',
      email: 'julie.martin@exemple.fr',
    });
    expect(saisieLocataire(ANTOINE)).toEqual({ locataire: 'Antoine Dupont', email: '' });
    expect(locataireDepuisSaisie({ locataire: 'Julie Martin-Roux', email: '' })).toEqual({
      ok: true,
      locataire: { prenom: 'Julie', nom: 'Martin-Roux' },
    });
    expect(locataireDepuisSaisie({ locataire: 'Julie', email: 'faux' })).toEqual({
      ok: false,
      erreurs: ['locataire', 'email'],
    });
  });

  it('en mémoire : invalide, introuvable, puis enregistré ; sans e-mail, il est retiré', async () => {
    const client = clientGestionMemoire({ etat: ETAT_SEPTEMBRE });
    expect(
      await client.modifierLocataire('locataire-julie', { prenom: '', nom: 'Martin' }),
    ).toEqual({
      ok: false,
      code: 'invalide',
    });
    expect(await client.modifierLocataire('inconnu', { prenom: 'Julie', nom: 'Martin' })).toEqual({
      ok: false,
      code: 'introuvable',
    });
    expect(
      await client.modifierLocataire('locataire-julie', { prenom: 'Julie', nom: 'Martin-Roux' }),
    ).toEqual({ ok: true, valeur: locataire('locataire-julie', 'Julie', 'Martin-Roux') });
    expect(client.donnees().locataires[0]).not.toHaveProperty('email');
    expect(client.appels).toContain('modifierLocataire');
  });
});

describe('textes de Mes locataires', () => {
  it('nombre, période, erreurs', () => {
    expect(nombreDeLocataires(1)).toBe('1 locataire');
    expect(nombreDeLocataires(3)).toBe('3 locataires');
    expect(periodeDuLocataire('2025-10-01', undefined, AUJOURDHUI)).toBe(
      'Depuis le 1er octobre 2025',
    );
    expect(periodeDuLocataire('2026-10-01', undefined, AUJOURDHUI)).toBe(
      'Entrée le 1er octobre 2026',
    );
    expect(periodeDuLocataire('2025-10-01', '2026-08-31', AUJOURDHUI)).toBe(
      'Du 1er octobre 2025 au 31 août 2026',
    );
    expect(Object.keys(ERREURS_LOCATAIRE)).toEqual(['locataire', 'email']);
  });
});
