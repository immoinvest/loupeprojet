import { describe, expect, it } from 'vitest';

import { calculerProjet } from '../../src/calculer-projet';
import { projetExemple } from '../../src/exemples/t3-marseille';
import { ProjetSchema, type Projet, type ProjetEntree } from '../../src/schema';
import {
  anneeInconnue,
  appartement,
  avecAscenseur,
  avecExterieur,
  construitAvant,
  contexteVisite,
  copro,
  coproEnProcedure,
  dpeInconnu,
  dpeParmi,
  enZoneARisque,
  etageEleveSansAscenseur,
  exploitationParmi,
  feu,
  honorairesAgence,
  installationsAnciennes,
  lotsInconnus,
  loyerEncadre,
  maison,
  meuble,
  non,
  parametreAnnee,
  parametreChambreM2,
  parametreDpe,
  parametreEcartPrix,
  parametreEtage,
  rezDeChaussee,
  risquesSignales,
  tous,
  travauxPrevus,
  typeExploitation,
} from '../../src/visite/contexte';
import type { ContexteVisite } from '../../src/visite/types';

const exemple = calculerProjet(projetExemple);
const contexteExemple = contexteVisite(exemple.projet, exemple.verdict.feux);

/** Un contexte forgé : le projet d'exemple, modifié bien par bien, sans recalcul. */
function forge(
  bien: Partial<ProjetEntree['bien']> = {},
  reste: Partial<Omit<ProjetEntree, 'bien'>> = {},
): ContexteVisite {
  const projet: Projet = ProjetSchema.parse({
    ...projetExemple,
    ...reste,
    bien: { ...projetExemple.bien, ...bien },
  });
  return { ...contexteExemple, projet };
}

describe('typeExploitation', () => {
  it('traduit les cinq modes du projet', () => {
    const avec = (location: ProjetEntree['hypotheses']['location']): Projet =>
      ProjetSchema.parse({
        ...projetExemple,
        hypotheses: { ...projetExemple.hypotheses, location },
      });
    expect(typeExploitation(avec({ mode: 'nu', loyerHc: 900 }))).toBe('nue');
    expect(typeExploitation(avec({ mode: 'meuble', loyerHc: 900 }))).toBe('meublee');
    expect(typeExploitation(avec({ mode: 'colocation', chambres: 3, loyerChambre: 450 }))).toBe(
      'colocation',
    );
    expect(typeExploitation(avec({ mode: 'courte_duree', nuitee: 80, nuiteesParMois: 15 }))).toBe(
      'courte_duree',
    );
    expect(typeExploitation(avec({ mode: 'moyenne_duree', loyerHc: 900 }))).toBe('moyenne_duree');
  });
});

describe('contexteVisite', () => {
  it('rassemble le projet, son exploitation, les feux, les règles et l’année de référence', () => {
    expect(contexteExemple.exploitation).toBe('meublee');
    expect(contexteExemple.feux).toHaveLength(5);
    expect(contexteExemple.regles.version).toBe('2026-09');
    expect(contexteExemple.anneeReference).toBe(2026);
    expect(contexteExemple.regles.visite).toEqual({
      amianteAvantAnnee: 1997,
      plombAvantAnnee: 1949,
      installationsAnciennesAns: 15,
      etageSansAscenseur: 3,
      chambreColocationM2: 9,
    });
  });
});

describe('prédicats sur le bien', () => {
  it('copropriété, procédure, lots', () => {
    expect(copro(contexteExemple)).toBe(true);
    expect(copro(forge({ copro: undefined }))).toBe(false);
    expect(coproEnProcedure(contexteExemple)).toBe(false);
    expect(coproEnProcedure(forge({ copro: { procedure: true } }))).toBe(true);
    expect(coproEnProcedure(forge({ copro: undefined }))).toBe(false);
    expect(lotsInconnus(contexteExemple)).toBe(false);
    expect(lotsInconnus(forge({ copro: {} }))).toBe(true);
    expect(lotsInconnus(forge({ copro: undefined }))).toBe(false);
  });

  it('maison ou appartement', () => {
    expect(appartement(contexteExemple)).toBe(true);
    expect(maison(contexteExemple)).toBe(false);
    expect(maison(forge({ type: 'maison' }))).toBe(true);
    expect(appartement(forge({ type: 'maison' }))).toBe(false);
  });

  it('année de construction : amiante avant 1997, plomb avant 1949, inconnue', () => {
    const amiante = construitAvant('amianteAvantAnnee');
    const plomb = construitAvant('plombAvantAnnee');
    expect(amiante(contexteExemple)).toBe(true);
    expect(plomb(contexteExemple)).toBe(false);
    expect(plomb(forge({ annee: 1930 }))).toBe(true);
    expect(amiante(forge({ annee: 1997 }))).toBe(false);
    expect(amiante(forge({ annee: undefined }))).toBe(false);
    expect(anneeInconnue(forge({ annee: undefined }))).toBe(true);
    expect(anneeInconnue(contexteExemple)).toBe(false);
  });

  it('installations anciennes : plus de quinze ans, ou âge inconnu', () => {
    expect(installationsAnciennes(contexteExemple)).toBe(true);
    expect(installationsAnciennes(forge({ annee: 2011 }))).toBe(true);
    expect(installationsAnciennes(forge({ annee: 2012 }))).toBe(false);
    expect(installationsAnciennes(forge({ annee: undefined }))).toBe(true);
  });

  it('DPE connu, inconnu, parmi des classes', () => {
    expect(dpeInconnu(contexteExemple)).toBe(false);
    expect(dpeInconnu(forge({ dpe: undefined }))).toBe(true);
    expect(dpeParmi('E', 'F', 'G')(contexteExemple)).toBe(false);
    expect(dpeParmi('D')(contexteExemple)).toBe(true);
    expect(dpeParmi('D')(forge({ dpe: undefined }))).toBe(false);
  });

  it('étage et ascenseur, extérieur', () => {
    expect(etageEleveSansAscenseur(contexteExemple)).toBe(true);
    expect(etageEleveSansAscenseur(forge({ etage: 2 }))).toBe(false);
    expect(etageEleveSansAscenseur(forge({ ascenseur: true }))).toBe(false);
    expect(etageEleveSansAscenseur(forge({ ascenseur: undefined }))).toBe(false);
    expect(etageEleveSansAscenseur(forge({ etage: undefined }))).toBe(false);
    expect(rezDeChaussee(contexteExemple)).toBe(false);
    expect(rezDeChaussee(forge({ etage: 0 }))).toBe(true);
    expect(rezDeChaussee(forge({ etage: undefined }))).toBe(false);
    expect(avecAscenseur(contexteExemple)).toBe(false);
    expect(avecAscenseur(forge({ ascenseur: true }))).toBe(true);
    expect(avecExterieur(contexteExemple)).toBe(false);
    expect(avecExterieur(forge({ exterieur: true }))).toBe(true);
  });
});

describe('prédicats sur l’exploitation, le marché, l’achat et le verdict', () => {
  it('exploitation parmi, meublé', () => {
    expect(exploitationParmi('meublee')(contexteExemple)).toBe(true);
    expect(exploitationParmi('nue', 'colocation')(contexteExemple)).toBe(false);
    expect(meuble(contexteExemple)).toBe(true);
    expect(meuble({ ...contexteExemple, exploitation: 'nue' })).toBe(false);
    expect(meuble({ ...contexteExemple, exploitation: 'moyenne_duree' })).toBe(true);
  });

  it('travaux prévus : montant, ou état à rénover ou à rafraîchir', () => {
    expect(travauxPrevus(contexteExemple)).toBe(true);
    const sans = {
      ...projetExemple.hypotheses,
      achat: { ...projetExemple.hypotheses.achat, travaux: 0 },
    };
    expect(travauxPrevus(forge({}, { hypotheses: sans }))).toBe(false);
    expect(travauxPrevus(forge({ etat: 'a_renover' }, { hypotheses: sans }))).toBe(true);
    expect(travauxPrevus(forge({ etat: 'a_rafraichir' }, { hypotheses: sans }))).toBe(true);
    expect(travauxPrevus(forge({ etat: 'renove' }, { hypotheses: sans }))).toBe(false);
  });

  it('honoraires d’agence, loyer encadré', () => {
    expect(honorairesAgence(contexteExemple)).toBe(true);
    const sans = { ...projetExemple.hypotheses, achat: { prix: 155_000 } };
    expect(honorairesAgence(forge({}, { hypotheses: sans }))).toBe(false);
    expect(loyerEncadre(contexteExemple)).toBe(false);
    expect(loyerEncadre(forge({}, { marche: { plafondLoyerMensuel: 900 } }))).toBe(true);
  });

  it('risques signalés : moyen ou fort, jamais faible', () => {
    expect(risquesSignales(contexteExemple)).toEqual(['argiles']);
    expect(enZoneARisque(contexteExemple)).toBe(true);
    const faible = forge({}, { marche: { risques: [{ type: 'radon', niveau: 'faible' }] } });
    expect(risquesSignales(faible)).toEqual([]);
    expect(enZoneARisque(faible)).toBe(false);
    const deux = forge(
      {},
      {
        marche: {
          risques: [
            { type: 'inondation', niveau: 'fort' },
            { type: 'seisme', niveau: 'moyen' },
          ],
        },
      },
    );
    expect(risquesSignales(deux)).toEqual(['inondation', 'seisme']);
  });

  it('feu : axe et état', () => {
    expect(feu('prix', 'bon')(contexteExemple)).toBe(true);
    expect(feu('prix', 'probleme')(contexteExemple)).toBe(false);
    expect(feu('cashflow', 'probleme')(contexteExemple)).toBe(true);
  });

  it('tous et non', () => {
    expect(tous(copro, appartement)(contexteExemple)).toBe(true);
    expect(tous(copro, maison)(contexteExemple)).toBe(false);
    expect(tous()(contexteExemple)).toBe(true);
    expect(non(maison)(contexteExemple)).toBe(true);
    expect(non(copro)(contexteExemple)).toBe(false);
  });
});

describe('paramètres partagés', () => {
  it('rendent des valeurs brutes, avec un repli quand la donnée manque', () => {
    expect(parametreDpe(contexteExemple)).toEqual({ dpe: 'D' });
    expect(parametreDpe(forge({ dpe: undefined }))).toEqual({ dpe: '' });
    expect(parametreAnnee(contexteExemple)).toEqual({ annee: 1962 });
    expect(parametreAnnee(forge({ annee: undefined }))).toEqual({ annee: 0 });
    expect(parametreEtage(contexteExemple)).toEqual({ etage: 3 });
    expect(parametreEtage(forge({ etage: undefined }))).toEqual({ etage: 0 });
    expect(parametreChambreM2(contexteExemple)).toEqual({ chambreM2: 9 });
    const ecart = parametreEcartPrix(contexteExemple).ecart;
    expect(typeof ecart).toBe('number');
    expect(Number(ecart)).toBeLessThan(-0.05);
    expect(parametreEcartPrix({ ...contexteExemple, feux: [] })).toEqual({ ecart: 0 });
    expect(
      parametreEcartPrix({
        ...contexteExemple,
        feux: [{ axe: 'prix', feu: 'inconnu', valeur: null, raison: null }],
      }),
    ).toEqual({ ecart: 0 });
  });
});
