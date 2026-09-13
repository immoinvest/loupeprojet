import { ProjetSchema, calculerProjet } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import {
  construireProjet,
  departementDuCodePostal,
  extraireChamps,
  nomDuProjet,
  resoudreAnnonce,
  tauxPourDuree,
  type SaisieProjet,
} from '@/annonces';

describe('resoudreAnnonce', () => {
  it('reconnaît les cinq portails et retire les paramètres de suivi', () => {
    expect(
      resoudreAnnonce('https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851?utm_source=x'),
    ).toEqual({
      portail: 'leboncoin',
      id: '2214738851',
      urlCanonique: 'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851',
    });
    expect(
      resoudreAnnonce(
        'https://www.seloger.com/annonces/achat/appartement/marseille-13/baille/234567890.htm#x',
      ),
    ).toMatchObject({ portail: 'seloger', id: '234567890' });
    expect(
      resoudreAnnonce(
        'https://www.bienici.com/annonce/vente/marseille-5e/appartement/3pieces/ag13-123456',
      ),
    ).toMatchObject({
      portail: 'bienici',
      id: 'ag13-123456',
    });
    expect(
      resoudreAnnonce('https://www.pap.fr/annonces/appartement-marseille-13005-r456789012'),
    ).toMatchObject({
      portail: 'pap',
      id: '456789012',
    });
    expect(resoudreAnnonce('https://www.logic-immo.com/detail-vente-1234567.htm')).toMatchObject({
      portail: 'logicimmo',
      id: '1234567',
    });
  });

  it('rend null pour un texte qui n’est pas une URL, un site inconnu ou une page sans identifiant', () => {
    expect(resoudreAnnonce('pas une url')).toBeNull();
    expect(resoudreAnnonce('https://www.exemple.fr/annonce/123456')).toBeNull();
    expect(resoudreAnnonce('https://www.leboncoin.fr/recherche?category=9')).toBeNull();
  });
});

const ANNONCE = `Appartement T3 de 65 m² à Marseille 5e (13005), quartier Baille.
Au 3e étage sans ascenseur d'un immeuble construit en 1962, 24 lots.
Prix : 155 000 € (honoraires charge acquéreur : 7 000 € inclus).
2 chambres, cuisine séparée. Charges de copropriété : 90 € / mois. Taxe foncière : 1 050 €.
DPE : D. Loué meublé jusqu'en juin.`;

describe('extraireChamps', () => {
  it('lit les champs d’une annonce typique', () => {
    const c = extraireChamps(ANNONCE);
    expect(c).toMatchObject({
      prix: 155_000,
      surface: 65,
      pieces: 3,
      chambres: 2,
      etage: 3,
      ascenseur: false,
      dpe: 'D',
      codePostal: '13005',
      ville: 'Marseille 5e',
      annee: 1962,
      chargesCoproMois: 90,
      taxeFonciere: 1_050,
      honorairesAgence: 7_000,
      meuble: true,
    });
  });

  it('gère les variantes : « 13005 Marseille », « 3 pièces », « rez-de-chaussée », « avec ascenseur », prix sans séparateur', () => {
    const c = extraireChamps(
      'Beau 3 pièces de 58,5 m2, 13005 Marseille, rez-de-chaussée avec ascenseur, classe énergie C, prix 149900 €, 120 € de charges',
    );
    expect(c).toMatchObject({
      prix: 149_900,
      surface: 58.5,
      pieces: 3,
      etage: 0,
      ascenseur: true,
      dpe: 'C',
      codePostal: '13005',
      ville: 'Marseille',
      chargesCoproMois: 120,
    });
    expect(c.meuble).toBeUndefined();
    expect(c.taxeFonciere).toBeUndefined();
  });

  it('ignore les petits montants pour le prix et rend un objet vide sans rien', () => {
    expect(extraireChamps('Loyer 980 € par mois, charges 60 €')).toEqual({});
    expect(extraireChamps('')).toEqual({});
  });
});

describe('construireProjet', () => {
  const saisie: SaisieProjet = {
    prix: 155_000,
    honorairesAgence: 7_000,
    surface: 65,
    pieces: 3,
    chambres: 2,
    etage: 3,
    ascenseur: false,
    annee: 1962,
    dpe: 'D',
    codePostal: '13005',
    ville: 'Marseille 5e',
    chargesCoproMois: 90,
    taxeFonciere: 1_050,
    mode: 'meuble_lld',
    loyerHc: 980,
    apport: 15_000,
    dureeAnnees: 25,
    tmi: 0.3,
    revenusMensuels: 2_600,
    provenance: {
      prix: 'annonce',
      surface: 'annonce',
      dpe: 'annonce',
      taxeFonciere: 'annonce',
      chargesCoproMois: 'annonce',
    },
    annonce: {
      portail: 'leboncoin',
      id: '2214738851',
      urlCanonique: 'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851',
    },
  };

  it('produit un projet valide que le moteur calcule', () => {
    const projet = construireProjet(saisie, 'p1');
    const parse = ProjetSchema.parse(projet);
    expect(parse.bien.departement).toBe('13');
    expect(parse.hypotheses.charges.coproAnnuel).toBe(1_080);
    expect(parse.hypotheses.charges.taxeFonciere).toBe(1_050);
    expect(parse.hypotheses.fiscalite.regime).toBe('lmnp_reel');
    expect(parse.hypotheses.pret.tauxNominal).toBe(0.0335);
    expect(parse.hypotheses.achat.mobilier).toBe(65 * 75);
    expect(projet.provenance?.['achat.prix']).toBe('annonce');
    expect(projet.provenance?.['charges.taxeFonciere']).toBe('annonce');
    expect(calculerProjet(projet).verdict.feux[0]?.feu).toBe('inconnu');
    expect(nomDuProjet(saisie)).toBe('T3 · 65 m² · Marseille 5e');
  });

  it('estime ce qui manque et adapte le nu', () => {
    const nu: SaisieProjet = {
      ...saisie,
      pieces: undefined,
      chambres: undefined,
      etage: undefined,
      ascenseur: undefined,
      annee: undefined,
      dpe: undefined,
      chargesCoproMois: undefined,
      taxeFonciere: undefined,
      honorairesAgence: undefined,
      annonce: undefined,
      mode: 'nu',
      loyerHc: 850,
      provenance: {},
    };
    const projet = construireProjet(nu, 'p2');
    const parse = ProjetSchema.parse(projet);
    expect(parse.bien.pieces).toBe(3);
    expect(parse.hypotheses.charges.taxeFonciere).toBe(850);
    expect(parse.hypotheses.charges.coproAnnuel).toBe(65 * 25);
    expect(parse.hypotheses.charges.comptable).toBe(0);
    expect(parse.hypotheses.charges.cfe).toBe(0);
    expect(parse.hypotheses.achat.mobilier).toBe(0);
    expect(parse.hypotheses.fiscalite.regime).toBe('nu_reel');
    expect(projet.provenance?.['charges.taxeFonciere']).toBe('estime');
    expect(projet.provenance?.['achat.prix']).toBe('utilisateur');
    expect(projet.provenance?.['bien.dpe']).toBeUndefined();
    expect(nomDuProjet(nu)).toBe('65 m² · Marseille 5e');
  });

  it('valeurs saisies à la main (sans provenance) : marquées « utilisateur »', () => {
    const projet = construireProjet({ ...saisie, provenance: {}, annonce: undefined }, 'p4');
    expect(projet.provenance?.['charges.taxeFonciere']).toBe('utilisateur');
    expect(projet.provenance?.['charges.coproAnnuel']).toBe('utilisateur');
    expect(projet.provenance?.['bien.dpe']).toBe('utilisateur');
    expect(projet.provenance?.['achat.prix']).toBe('utilisateur');
    expect(projet.source).toBeUndefined();
  });

  it('courte durée : nuitée et occupation par défaut', () => {
    const cd = construireProjet({ ...saisie, mode: 'courte_duree' }, 'p3');
    expect(ProjetSchema.parse(cd).hypotheses.location.courteDuree?.tauxOccupation).toBe(0.6);
  });

  it('département et taux', () => {
    expect(departementDuCodePostal('13005')).toBe('13');
    expect(departementDuCodePostal('20000')).toBe('2A');
    expect(departementDuCodePostal('20200')).toBe('2B');
    expect(departementDuCodePostal('97400')).toBe('974');
    expect(departementDuCodePostal('98800')).toBe('988');
    expect(tauxPourDuree(10)).toBe(0.0314);
    expect(tauxPourDuree(20)).toBe(0.0327);
    expect(tauxPourDuree(25)).toBe(0.0335);
  });
});
