import { LocationSchema, type LocationEntree } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import { brouillonDepuisProjet, creationPret, type Brouillon } from '@/gestion/depuis-projet';
import { creerProjet, type AdresseBien, type ProjetEnregistre } from '@/stockage/projets';
import { ERREURS_PRET, locationEnLettres, sousTitrePret } from '@/textes/gerer-pret';

const ADRESSE: AdresseBien = {
  libelle: '12 rue des Lices 13005 Marseille',
  lat: 43.2931,
  lon: 5.3942,
  codeInsee: '13205',
  codeVoie: '5470',
  numero: 12,
  codePostal: '13005',
};

const MEUBLE: LocationEntree = { mode: 'meuble', loyerHc: 650, chargesLocataire: 50 };
const NU: LocationEntree = { mode: 'nu', loyerHc: 700, chargesLocataire: 40 };

/** Le projet d'exemple, avec la location (validée par le moteur) et l'adresse voulues. */
function projet(location: LocationEntree, adresse?: AdresseBien): ProjetEnregistre {
  const base = creerProjet({ nom: 'T3 · 65 m² · Marseille 5e', statut: 'offre' });
  const hypotheses = { ...base.projet.hypotheses, location: LocationSchema.parse(location) };
  const avecLocation: ProjetEnregistre = { ...base, projet: { ...base.projet, hypotheses } };
  return adresse === undefined ? avecLocation : { ...avecLocation, adresse };
}

describe('brouillonDepuisProjet', () => {
  it('reprend le bien et la location de l’analyse, en centimes, avec les défauts datés', () => {
    const p = projet(MEUBLE, ADRESSE);
    const b = brouillonDepuisProjet(p, '2026-09-14');
    expect(b.bien).toEqual({
      nom: 'T3 · 65 m² · Marseille 5e',
      adresse: ADRESSE.libelle,
      codePostal: '13005',
      type: p.projet.bien.type,
      surface: p.projet.bien.surface,
      meuble: true,
      projetId: p.id,
      projet: p.projet,
    });
    expect(b.location).toEqual({
      type: 'meublee',
      debut: '2026-10-01',
      jourLoyer: 5,
      loyerHorsCharges: 65_000,
      charges: 5_000,
      depot: 130_000,
    });
  });

  it.each([
    [
      'nue : un mois de dépôt',
      NU,
      { type: 'nue', loyerHorsCharges: 70_000, charges: 4_000, depot: 70_000 },
      false,
    ],
    [
      'colocation : toutes les chambres et leurs forfaits de charges',
      { mode: 'colocation', chambres: 3, loyerChambre: 450, forfaitChargesChambre: 60 },
      { type: 'meublee', loyerHorsCharges: 135_000, charges: 18_000, depot: 270_000 },
      true,
    ],
    [
      'moyenne durée : forfait de charges, pas de dépôt (bail mobilité)',
      { mode: 'moyenne_duree', loyerHc: 900, forfaitCharges: 80 },
      { type: 'meublee', loyerHorsCharges: 90_000, charges: 8_000, depot: 0 },
      true,
    ],
    [
      'courte durée : l’équivalent mensuel des nuitées, sans charges',
      { mode: 'courte_duree', nuitee: 80, nuiteesParMois: 18.25 },
      { type: 'meublee', loyerHorsCharges: 146_000, charges: 0, depot: 292_000 },
      true,
    ],
  ] as const)('location %s', (_nom, location, attendu, meuble) => {
    const b = brouillonDepuisProjet(projet(location), '2026-09-14');
    expect(b.bien.meuble).toBe(meuble);
    expect(b.location).toMatchObject(attendu);
  });

  it('sans adresse enregistrée : adresse à remplir, pas de code postal ; décembre passe l’année', () => {
    const b = brouillonDepuisProjet(projet(NU), '2026-12-20');
    expect(b.bien.adresse).toBe('');
    expect('codePostal' in b.bien).toBe(false);
    expect(b.location.debut).toBe('2027-01-01');
  });

  it('un nom de projet trop long est coupé à 80 caractères', () => {
    const long = { ...projet(NU), nom: 'x'.repeat(120) };
    expect(brouillonDepuisProjet(long, '2026-09-14').bien.nom).toHaveLength(80);
  });
});

describe('creationPret', () => {
  const brouillon: Brouillon = brouillonDepuisProjet(projet(MEUBLE, ADRESSE), '2026-09-14');
  const saisie = {
    adresse: ADRESSE.libelle,
    locataire: 'Julie Martin',
    email: 'julie.martin@exemple.fr',
  };

  it('« C’est parti » : bien, locataire et location', () => {
    expect(creationPret(brouillon, saisie, true)).toEqual({
      ok: true,
      creation: {
        bien: brouillon.bien,
        locataire: { prenom: 'Julie', nom: 'Martin', email: 'julie.martin@exemple.fr' },
        location: brouillon.location,
      },
    });
    const sansEmail = creationPret(brouillon, { ...saisie, email: ' ' }, true);
    expect(sansEmail).toMatchObject({
      ok: true,
      creation: { locataire: { prenom: 'Julie', nom: 'Martin' } },
    });
    expect(
      sansEmail.ok &&
        sansEmail.creation.locataire !== null &&
        'email' in sansEmail.creation.locataire,
    ).toBe(false);
  });

  it('« Pas encore loué » : un bien vacant, le locataire n’est pas demandé', () => {
    expect(
      creationPret(brouillon, { ...saisie, locataire: '', email: 'pas-un-email' }, false),
    ).toEqual({
      ok: true,
      creation: { bien: brouillon.bien, locataire: null, location: null },
    });
  });

  it('l’adresse, le nom et l’e-mail à corriger, dans l’ordre de l’écran', () => {
    expect(
      creationPret(brouillon, { adresse: ' ', locataire: 'Julie', email: 'julie@' }, true),
    ).toEqual({
      ok: false,
      erreurs: ['adresse', 'locataire', 'email'],
    });
    expect(creationPret(brouillon, { ...saisie, adresse: '' }, false)).toEqual({
      ok: false,
      erreurs: ['adresse'],
    });
    expect(creationPret(brouillon, { ...saisie, email: 'julie@' }, true)).toEqual({
      ok: false,
      erreurs: ['email'],
    });
  });
});

describe('textes de « Prêt à gérer »', () => {
  it('sous-titre, location en lettres avec ou sans charges, erreurs', () => {
    expect(sousTitrePret('T2 Lices')).toBe(
      'T2 Lices · tout vient de ton analyse. Tu pourras tout changer ensuite.',
    );
    expect(locationEnLettres(true, 65_000, 5_000).replace(/\s/g, ' ')).toBe(
      'Meublée · 650 € + 50 € de charges',
    );
    expect(locationEnLettres(false, 65_050, 0).replace(/\s/g, ' ')).toBe('Vide · 650,50 €');
    expect(ERREURS_PRET.adresse).toBe('Indique l’adresse du bien.');
  });
});
