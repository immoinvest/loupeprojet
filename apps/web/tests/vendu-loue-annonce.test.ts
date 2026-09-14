import { describe, expect, it } from 'vitest';

import { construireProjet, extraireChamps } from '@/annonces';
import { valeursDepuisChamps, versSaisie } from '@/ecrans/formulaire/valeurs';
import { fusionnerChamps, type ChampsIa } from '@/enrichissement';
import { ReponseExtractionSchema } from '@/enrichissement/contrat';

const IA_VIDE: ChampsIa = {
  prix: null,
  surface: null,
  pieces: null,
  chambres: null,
  etage: null,
  ascenseur: null,
  dpe: null,
  codePostal: null,
  ville: null,
  annee: null,
  chargesCoproMois: null,
  taxeFonciere: null,
  honorairesAgence: null,
  meuble: null,
};

describe('vendu loué lu dans l’annonce', () => {
  it('reconnaît un locataire en place', () => {
    for (const texte of [
      'T2 vendu loué 650 € par mois',
      'Vente occupée, idéal investisseur',
      'Locataire en place depuis 2021',
      'Bail en cours jusqu’en 2027',
      'Studio actuellement loué',
    ]) {
      expect(extraireChamps(texte).venduLoue, texte).toBe(true);
    }
  });

  it('la mention « libre » l’emporte ; un texte muet ne décide rien', () => {
    for (const texte of [
      'Appartement vendu libre',
      'Actuellement loué, libre à la vente',
      'Libre de toute occupation',
      'Maison livrée libre de tout occupant',
    ]) {
      expect(extraireChamps(texte).venduLoue, texte).toBe(false);
    }
    expect(extraireChamps('Idéal investisseur, possibilité de louer').venduLoue).toBeUndefined();
  });

  it('un loyer actuel lu par l’IA vaut vendu loué, sauf mention « libre »', () => {
    expect(fusionnerChamps({}, { ...IA_VIDE, loyerActuel: 620 })).toEqual({ venduLoue: true });
    expect(fusionnerChamps({ venduLoue: false }, { ...IA_VIDE, loyerActuel: 620 })).toEqual({
      venduLoue: false,
    });
    expect(fusionnerChamps({ venduLoue: true }, { ...IA_VIDE, loyerActuel: null })).toEqual({
      venduLoue: true,
    });
    expect(fusionnerChamps({}, { ...IA_VIDE, loyerActuel: 0 })).toEqual({});
    expect(fusionnerChamps({}, IA_VIDE)).toEqual({});
  });

  it('accepte le loyer actuel renvoyé par le Worker, et son absence', () => {
    const champs = { ...IA_VIDE, etat: null, exterieur: null, typeLocation: null };
    expect(
      ReponseExtractionSchema.parse({ champs: { ...champs, loyerActuel: 540 }, modele: 'm' }).champs
        .loyerActuel,
    ).toBe(540);
    expect(
      ReponseExtractionSchema.parse({ champs, modele: 'm' }).champs.loyerActuel,
    ).toBeUndefined();
    expect(() =>
      ReponseExtractionSchema.parse({ champs: { ...champs, loyerActuel: -1 }, modele: 'm' }),
    ).toThrow();
  });

  it('passe par le formulaire Vérifier jusqu’au bien du projet, avec sa provenance', () => {
    const initial = valeursDepuisChamps({ venduLoue: true });
    expect(initial.valeurs.venduLoue).toBe('oui');
    expect(initial.provenance.venduLoue).toBe('annonce');
    const base = { ...initial.valeurs, prix: '120000', surface: '30', codePostal: '13005' };
    const projet = construireProjet(
      versSaisie({ ...base, ville: 'Marseille' }, initial.provenance, null),
      'p1',
    );
    expect(projet.bien.venduLoue).toBe(true);
    expect(projet.provenance?.['bien.venduLoue']).toBe('annonce');

    const libre = construireProjet(
      versSaisie({ ...base, ville: 'Marseille', venduLoue: 'non' }, {}, null),
      'p2',
    );
    expect(libre.bien.venduLoue).toBe(false);
    expect(libre.provenance?.['bien.venduLoue']).toBe('utilisateur');

    const vide = construireProjet(
      versSaisie({ ...base, ville: 'Marseille', venduLoue: '' }, {}, null),
      'p3',
    );
    expect(vide.bien.venduLoue).toBeUndefined();
    expect(vide.provenance?.['bien.venduLoue']).toBeUndefined();
  });
});
