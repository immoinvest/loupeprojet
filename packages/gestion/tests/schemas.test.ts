import { describe, expect, it } from 'vitest';

import { depotParDefaut, MONTANT_MAX_CENTIMES } from '../src/regles';
import {
  CreationLocationSchema,
  CreationReponseSchema,
  EtatGestionSchema,
  LocationGereeSchema,
  NouveauPaiementSchema,
  PREFERENCES_PAR_DEFAUT,
  PreferencesMenuSchema,
  type CreationLocation,
} from '../src/schemas';
import { bien, locataire, location, paiement } from './exemples';

const CREATION: CreationLocation = {
  bien: {
    nom: 'T2 Lices',
    adresse: '12 rue des Lices',
    codePostal: '13005',
    ville: 'Marseille',
    type: 'appartement',
    surface: 38,
    meuble: true,
  },
  locataire: { prenom: 'Julie', nom: 'Martin', email: 'julie.martin@exemple.fr' },
  location: {
    type: 'meublee',
    debut: '2026-10-01',
    jourLoyer: 5,
    loyerHorsCharges: 65_000,
    charges: 5_000,
    depot: 130_000,
  },
};

function cheminsErreur(resultat: {
  success: boolean;
  error?: { issues: { path: PropertyKey[] }[] };
}): string[] {
  return (resultat.error?.issues ?? []).map((i) => i.path.map(String).join('.'));
}

describe('CreationLocationSchema', () => {
  it('accepte un bien loué complet et nettoie les espaces des textes', () => {
    const r = CreationLocationSchema.parse({
      ...CREATION,
      locataire: { prenom: ' Julie ', nom: 'Martin ' },
    });
    expect(r.locataire).toEqual({ prenom: 'Julie', nom: 'Martin' });
    expect(r.location?.loyerHorsCharges).toBe(65_000);
  });

  it('accepte un bien vacant : ni locataire ni location', () => {
    expect(
      CreationLocationSchema.safeParse({ bien: CREATION.bien, locataire: null, location: null })
        .success,
    ).toBe(true);
  });

  it('refuse un locataire sans location, et l’inverse', () => {
    const sansLocation = CreationLocationSchema.safeParse({ ...CREATION, location: null });
    expect(cheminsErreur(sansLocation)).toEqual(['location']);
    const sansLocataire = CreationLocationSchema.safeParse({ ...CREATION, locataire: null });
    expect(cheminsErreur(sansLocataire)).toEqual(['location']);
  });

  it.each([
    ['bien.nom', { bien: { ...CREATION.bien, nom: 'x'.repeat(81) } }],
    ['bien.adresse', { bien: { ...CREATION.bien, adresse: '   ' } }],
    ['bien.codePostal', { bien: { ...CREATION.bien, codePostal: '1300' } }],
    ['bien.surface', { bien: { ...CREATION.bien, surface: 0 } }],
    ['bien.type', { bien: { ...CREATION.bien, type: 'chateau' } }],
    ['locataire.email', { locataire: { prenom: 'Julie', nom: 'Martin', email: '' } }],
    ['location.jourLoyer', { location: { ...CREATION.location, jourLoyer: 29 } }],
    ['location.jourLoyer', { location: { ...CREATION.location, jourLoyer: 0 } }],
    ['location.loyerHorsCharges', { location: { ...CREATION.location, loyerHorsCharges: -1 } }],
    ['location.loyerHorsCharges', { location: { ...CREATION.location, loyerHorsCharges: 650.5 } }],
    ['location.charges', { location: { ...CREATION.location, charges: MONTANT_MAX_CENTIMES + 1 } }],
    ['location.debut', { location: { ...CREATION.location, debut: '2026-02-30' } }],
    ['location.fin', { location: { ...CREATION.location, fin: '2026-09-30' } }],
  ])('refuse une valeur fautive de %s', (chemin, surcharge) => {
    expect(cheminsErreur(CreationLocationSchema.safeParse({ ...CREATION, ...surcharge }))).toEqual([
      chemin,
    ]);
  });

  it('accepte une sortie le jour de l’entrée et un e-mail absent', () => {
    const r = CreationLocationSchema.safeParse({
      ...CREATION,
      locataire: { prenom: 'Julie', nom: 'Martin' },
      location: { ...CREATION.location, fin: '2026-10-01' },
    });
    expect(r.success).toBe(true);
  });
});

describe('location, paiement, préférences, état', () => {
  it('une location enregistrée refuse aussi une sortie avant l’entrée', () => {
    const r = LocationGereeSchema.safeParse({ ...location('l1'), fin: '2025-09-30' });
    expect(cheminsErreur(r)).toEqual(['fin']);
  });

  it('un paiement porte au moins un centime, sur un mois valide', () => {
    const valide = { locationId: 'l1', periode: '2026-10', montant: 70_000, date: '2026-10-05' };
    expect(NouveauPaiementSchema.safeParse(valide).success).toBe(true);
    expect(cheminsErreur(NouveauPaiementSchema.safeParse({ ...valide, montant: 0 }))).toEqual([
      'montant',
    ]);
    expect(
      cheminsErreur(NouveauPaiementSchema.safeParse({ ...valide, periode: '2026-13' })),
    ).toEqual(['periode']);
  });

  it('les préférences gardent au moins une section', () => {
    expect(PreferencesMenuSchema.parse(PREFERENCES_PAR_DEFAUT)).toEqual({
      analyser: true,
      gerer: true,
    });
    expect(PreferencesMenuSchema.safeParse({ analyser: false, gerer: true }).success).toBe(true);
    expect(
      cheminsErreur(PreferencesMenuSchema.safeParse({ analyser: false, gerer: false })),
    ).toEqual(['gerer']);
  });

  it('l’état complet et la réponse de création se valident', () => {
    const etat = {
      biens: [bien('bien-lices', 'T2 Lices')],
      locataires: [locataire('locataire-julie', 'Julie', 'Martin')],
      locations: [location('l1')],
      paiements: [paiement('p1', 'l1', '2026-09', 70_000)],
      preferences: PREFERENCES_PAR_DEFAUT,
    };
    expect(EtatGestionSchema.parse(etat)).toEqual(etat);
    expect(
      CreationReponseSchema.safeParse({ bien: etat.biens[0], locataire: null, location: null })
        .success,
    ).toBe(true);
  });
});

describe('depotParDefaut', () => {
  it('propose le maximum légal : un mois vide, deux mois meublé', () => {
    expect(depotParDefaut('nue', 65_000)).toBe(65_000);
    expect(depotParDefaut('meublee', 65_000)).toBe(130_000);
  });
});
