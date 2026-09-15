import { ProjetSchema, projetExemple, type Projet } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import {
  appliquerRepere,
  decisionRepere,
  instantaneRepere,
  marcheDepuisReference,
  memeRepere,
  repereSaisiALaMain,
  restaurerRepere,
  type ReferenceAdresse,
} from '@/enrichissement';

const STATS = { ventes: 6, medianeM2: 3600, q1M2: 3440, q3M2: 3750, minM2: 2929, maxM2: 4000 };
const REFERENCE: ReferenceAdresse = { code: 'meme_cote', rayonMetres: 90, statistiques: STATS };
const REPERE = marcheDepuisReference(REFERENCE);

const EXEMPLE: Projet = ProjetSchema.parse(projetExemple);

/** Le projet d'exemple avec un repère de quartier « donnée publique » et d'autres provenances. */
const PROJET: Projet = {
  ...EXEMPLE,
  marche: {
    risques: [],
    dvf: { medianM2: 3050, q1M2: 2700, q3M2: 3400, nombreVentes: 31, rayonMetres: 500 },
  },
  provenance: {
    ...EXEMPLE.provenance,
    'marche.dvf.medianM2': 'dvf',
    'marche.dvf.rayonMetres': 'dvf',
    'bien.etat': 'utilisateur',
  },
};

describe('repère de l’adresse appliqué tout seul', () => {
  it('décide : appliquer, déjà appliqué, ou protéger une saisie à la main', () => {
    expect(repereSaisiALaMain(PROJET)).toBe(false);
    expect(decisionRepere(PROJET, REPERE)).toBe('appliquer');

    const applique = appliquerRepere(PROJET, REPERE);
    expect(memeRepere(applique, REPERE)).toBe(true);
    expect(decisionRepere(applique, REPERE)).toBe('deja');

    const saisi: Projet = {
      ...PROJET,
      provenance: { ...PROJET.provenance, 'marche.dvf.medianM2': 'utilisateur' },
    };
    expect(repereSaisiALaMain(saisi)).toBe(true);
    expect(decisionRepere(saisi, REPERE)).toBe('proteger');

    const sansRepere: Projet = { ...PROJET, marche: { risques: [] } };
    expect(memeRepere(sansRepere, REPERE)).toBe(false);
    expect(
      memeRepere(
        { ...applique, marche: { ...applique.marche, dvf: { ...REPERE.dvf, nombreVentes: 7 } } },
        REPERE,
      ),
    ).toBe(false);
    expect(
      memeRepere(
        { ...applique, marche: { ...applique.marche, dvf: { ...REPERE.dvf, rayonMetres: 91 } } },
        REPERE,
      ),
    ).toBe(false);
  });

  it('applique le repère avec ses provenances et retire celles de l’ancien repère', () => {
    const avecQ1Saisi: Projet = {
      ...PROJET,
      provenance: { ...PROJET.provenance, 'marche.dvf.q1M2': 'utilisateur' },
    };
    const applique = appliquerRepere(avecQ1Saisi, REPERE);
    expect(applique.marche.dvf).toEqual(REPERE.dvf);
    expect(applique.marche.risques).toEqual(PROJET.marche.risques);
    expect(applique.provenance['marche.dvf.q1M2']).toBe('dvf');
    expect(applique.provenance['marche.dvf.medianM2']).toBe('dvf');
    expect(applique.provenance['bien.etat']).toBe('utilisateur');
  });

  it('« Annuler » remet le repère d’avant et ses provenances, ou aucun repère', () => {
    const avant = instantaneRepere(PROJET);
    expect(avant.provenance).toEqual({
      'marche.dvf.medianM2': 'dvf',
      'marche.dvf.rayonMetres': 'dvf',
    });
    const annule = restaurerRepere(appliquerRepere(PROJET, REPERE), avant);
    expect(annule.marche).toEqual(PROJET.marche);
    expect(annule.provenance).toEqual(PROJET.provenance);

    const sansRepere: Projet = {
      ...PROJET,
      marche: { risques: [] },
      provenance: { 'bien.etat': 'utilisateur' },
    };
    const vide = restaurerRepere(appliquerRepere(sansRepere, REPERE), instantaneRepere(sansRepere));
    expect(vide.marche).toEqual({ risques: [] });
    expect('dvf' in vide.marche).toBe(false);
    expect(vide.provenance).toEqual({ 'bien.etat': 'utilisateur' });
  });
});
