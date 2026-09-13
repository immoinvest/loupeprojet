import { describe, expect, it } from 'vitest';

import { construireProjet, extraireChamps } from '@/annonces';
import { valeursDepuisChamps, versSaisie } from '@/ecrans/formulaire/valeurs';
import { fusionnerChamps, type ChampsIa } from '@/enrichissement';

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

describe('état et extérieur lus dans le texte de l’annonce', () => {
  it('reconnaît les mots des annonces, du plus défavorable au plus favorable', () => {
    expect(extraireChamps('T3 à rénover, travaux à prévoir, beau balcon')).toMatchObject({
      etat: 'a_renover',
      exterieur: true,
    });
    expect(extraireChamps('Gros travaux, entièrement rénové il y a 30 ans')).toMatchObject({
      etat: 'a_renover',
    });
    expect(extraireChamps('Appartement à rafraîchir')).toMatchObject({ etat: 'a_rafraichir' });
    expect(extraireChamps('Entièrement rénové, avec terrasse')).toMatchObject({
      etat: 'renove',
      exterieur: true,
    });
    expect(extraireChamps('Refait à neuf, loggia')).toMatchObject({
      etat: 'renove',
      exterieur: true,
    });
    expect(extraireChamps('Cuisine et salle de bains rénovées')).toMatchObject({ etat: 'renove' });
    expect(extraireChamps('En bon état, sans balcon')).toMatchObject({
      etat: 'bon_etat',
      exterieur: false,
    });
  });

  it('ne devine rien : rénovation possible ou texte muet', () => {
    const champs = extraireChamps('Travaux de rénovation possibles, idéal pour les balconnets');
    expect(champs.etat).toBeUndefined();
    expect(champs.exterieur).toBeUndefined();
  });

  it('l’IA l’emporte quand elle trouve, les règles comblent sinon', () => {
    expect(
      fusionnerChamps(
        { etat: 'bon_etat', exterieur: true },
        { ...IA_VIDE, etat: 'renove', exterieur: null },
      ),
    ).toEqual({ etat: 'renove', exterieur: true });
    expect(fusionnerChamps({ etat: 'bon_etat' }, IA_VIDE)).toEqual({ etat: 'bon_etat' });
  });

  it('passe par le formulaire Vérifier jusqu’au bien du projet, avec sa provenance', () => {
    const initial = valeursDepuisChamps({ etat: 'renove', exterieur: true });
    expect(initial.valeurs).toMatchObject({ etat: 'renove', exterieur: 'oui' });
    expect(initial.provenance).toMatchObject({ etat: 'annonce', exterieur: 'annonce' });

    const saisie = versSaisie(
      {
        ...initial.valeurs,
        prix: '155000',
        surface: '65',
        codePostal: '13005',
        ville: 'Marseille',
      },
      initial.provenance,
      null,
    );
    expect(saisie).toMatchObject({ etat: 'renove', exterieur: true });
    const projet = construireProjet(saisie, 'p1');
    expect(projet.bien).toMatchObject({ etat: 'renove', exterieur: true });
    expect(projet.provenance).toMatchObject({
      'bien.etat': 'annonce',
      'bien.exterieur': 'annonce',
    });

    const vide = versSaisie(valeursDepuisChamps({}).valeurs, {}, null);
    expect(vide.etat).toBeUndefined();
    expect(vide.exterieur).toBeUndefined();
    const sansOrigine = construireProjet(
      { ...vide, etat: 'a_renover', exterieur: false, surface: 40, codePostal: '13005' },
      'p2',
    );
    expect(sansOrigine.provenance).toMatchObject({
      'bien.etat': 'utilisateur',
      'bien.exterieur': 'utilisateur',
    });
  });
});
