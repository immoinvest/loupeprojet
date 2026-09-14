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

/** Le projet d'exemple (meublé), avec le mode et l'adresse voulus. */
function projet(
  mode: 'meuble_lld' | 'nu' | 'courte_duree',
  adresse?: AdresseBien,
): ProjetEnregistre {
  const base = creerProjet({ nom: 'T3 · 65 m² · Marseille 5e', statut: 'offre' });
  const location = { ...base.projet.hypotheses.location, mode };
  const avecMode: ProjetEnregistre = {
    ...base,
    projet: { ...base.projet, hypotheses: { ...base.projet.hypotheses, location } },
  };
  return adresse === undefined ? avecMode : { ...avecMode, adresse };
}

describe('brouillonDepuisProjet', () => {
  it('reprend le bien et la location de l’analyse, en centimes, avec les défauts datés', () => {
    const p = projet('meuble_lld', ADRESSE);
    const { loyerHc, chargesLocataire } = p.projet.hypotheses.location;
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
      loyerHorsCharges: Math.round(loyerHc * 100),
      charges: Math.round(chargesLocataire * 100),
      depot: Math.round(loyerHc * 100) * 2,
    });
  });

  it('location nue : vide, un mois de dépôt ; courte durée : meublée', () => {
    const nue = brouillonDepuisProjet(projet('nu'), '2026-09-14');
    expect(nue.bien.meuble).toBe(false);
    expect(nue.location).toMatchObject({ type: 'nue', depot: nue.location.loyerHorsCharges });
    expect(brouillonDepuisProjet(projet('courte_duree'), '2026-09-14').location.type).toBe(
      'meublee',
    );
  });

  it('sans adresse enregistrée : adresse à remplir, pas de code postal ; décembre passe l’année', () => {
    const b = brouillonDepuisProjet(projet('nu'), '2026-12-20');
    expect(b.bien.adresse).toBe('');
    expect('codePostal' in b.bien).toBe(false);
    expect(b.location.debut).toBe('2027-01-01');
  });

  it('un nom de projet trop long est coupé à 80 caractères', () => {
    const long = { ...projet('nu'), nom: 'x'.repeat(120) };
    expect(brouillonDepuisProjet(long, '2026-09-14').bien.nom).toHaveLength(80);
  });
});

describe('creationPret', () => {
  const brouillon: Brouillon = brouillonDepuisProjet(projet('meuble_lld', ADRESSE), '2026-09-14');
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
