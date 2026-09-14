import { fraisNotaireEstimes, obtenirRegles } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import {
  CHAMPS_OFFRE,
  CHAMPS_PROJET,
  CLES_OFFRE,
  CLES_PROJET,
  NOMS_OFFRES,
  PRIX_DEFAUT,
  ajouterOffreB,
  appliquerTexte,
  estimerFraisNotaire,
  fraisNotaireManuels,
  nomOffre,
  offreDefaut,
  reestimerFraisNotaire,
  retirerOffreB,
  saisieDefaut,
  saisieDepuisSimulation,
  versSimulation,
  type Saisie,
} from '@/simulateur';

const regles = obtenirRegles('2026-09');
const FRAIS_150K = String(Math.round(fraisNotaireEstimes(150_000, 0, undefined, regles)));

describe('descripteurs', () => {
  it('décrivent chaque clé du projet et de l’offre, une fois, avec un libellé', () => {
    expect(CLES_PROJET).toEqual([
      'prix',
      'honorairesAgence',
      'travaux',
      'fraisNotaire',
      'departement',
      'revenusMensuels',
    ]);
    expect(CLES_OFFRE).toEqual([
      'nom',
      'apport',
      'tauxNominal',
      'dureeAnnees',
      'tauxAssurance',
      'fraisDossier',
      'fraisGarantie',
      'fraisBancairesFinances',
      'differeTotalMois',
      'differePartielMois',
    ]);
    for (const d of [...CHAMPS_PROJET, ...CHAMPS_OFFRE])
      expect(d.libelle.length).toBeGreaterThan(2);
    expect(CHAMPS_OFFRE.find((d) => d.chemin === 'fraisBancairesFinances')?.options).toHaveLength(
      2,
    );
  });
});

describe('saisieDefaut', () => {
  const s = saisieDefaut(regles);

  it('propose 150 000 €, des frais de notaire estimés et deux offres au taux du mois sur 20 ans', () => {
    expect(PRIX_DEFAUT).toBe(150_000);
    expect(s.projet).toEqual({
      prix: '150000',
      honorairesAgence: '0',
      travaux: '0',
      fraisNotaire: FRAIS_150K,
      departement: '',
      revenusMensuels: '',
    });
    expect(s.offres[0]).toEqual({
      nom: '',
      apport: '0',
      tauxNominal: '3.27',
      dureeAnnees: '20',
      tauxAssurance: '0.25',
      fraisDossier: '0',
      fraisGarantie: '0',
      fraisBancairesFinances: 'non',
      differeTotalMois: '0',
      differePartielMois: '0',
    });
    expect(s.offres[1]).toEqual(s.offres[0]);
    expect(s.offres[1]).not.toBe(s.offres[0]);
    expect(offreDefaut(regles)).toEqual(s.offres[0]);
  });

  it('se convertit en simulation valide, avec les noms « Offre A » et « Offre B »', () => {
    const c = versSimulation(s);
    expect(c.erreurs).toEqual({});
    expect(c.projet).toEqual({
      prix: 150_000,
      honorairesAgence: 0,
      travaux: 0,
      fraisNotaire: Number(FRAIS_150K),
    });
    expect(c.simulation?.versionRegles).toBe('2026-09');
    expect(c.simulation?.offres.map((o) => o.nom)).toEqual(['Offre A', 'Offre B']);
    expect(c.simulation?.offres[0]).toMatchObject({
      tauxNominal: 0.0327,
      dureeAnnees: 20,
      tauxAssurance: 0.0025,
      fraisBancairesFinances: false,
    });
    expect(c.offres[0]).toEqual(c.simulation?.offres[0]);
    expect(c.offres[1]).toEqual(c.simulation?.offres[1]);
  });
});

describe('nomOffre', () => {
  it('rend le nom saisi, sinon « Offre A » ou « Offre B »', () => {
    expect(NOMS_OFFRES).toEqual(['Offre A', 'Offre B']);
    expect(nomOffre(' LCL ', 0)).toBe('LCL');
    expect(nomOffre('', 0)).toBe('Offre A');
    expect(nomOffre('  ', 1)).toBe('Offre B');
  });
});

describe('estimerFraisNotaire et fraisNotaireManuels', () => {
  const projet = saisieDefaut(regles).projet;

  it('estime à partir du prix, des honoraires et du département', () => {
    expect(estimerFraisNotaire(projet, regles)).toBe(FRAIS_150K);
    expect(estimerFraisNotaire({ ...projet, prix: '150 000' }, regles)).toBe(FRAIS_150K);
    expect(
      Number(estimerFraisNotaire({ ...projet, honorairesAgence: '7000' }, regles)),
    ).toBeLessThan(Number(FRAIS_150K));
    expect(Number(estimerFraisNotaire({ ...projet, departement: ' 36 ' }, regles))).toBeLessThan(
      Number(FRAIS_150K),
    );
    expect(estimerFraisNotaire({ ...projet, honorairesAgence: '' }, regles)).toBe(FRAIS_150K);
  });

  it('ne sait pas estimer sans prix lisible ni honoraires lisibles', () => {
    expect(estimerFraisNotaire({ ...projet, prix: '' }, regles)).toBeNull();
    expect(estimerFraisNotaire({ ...projet, prix: 'abc' }, regles)).toBeNull();
    expect(estimerFraisNotaire({ ...projet, honorairesAgence: 'abc' }, regles)).toBeNull();
  });

  it('les frais sont « à toi » dès qu’ils diffèrent de l’estimation', () => {
    expect(fraisNotaireManuels(projet, regles)).toBe(false);
    expect(fraisNotaireManuels({ ...projet, fraisNotaire: '9000' }, regles)).toBe(true);
    expect(fraisNotaireManuels({ ...projet, fraisNotaire: ` ${FRAIS_150K} ` }, regles)).toBe(false);
    expect(fraisNotaireManuels({ ...projet, prix: 'abc' }, regles)).toBe(false);
  });
});

describe('appliquerTexte', () => {
  const s = saisieDefaut(regles);

  it('fait suivre les frais de notaire au prix, aux honoraires et au département tant qu’ils sont estimés', () => {
    const prix = appliquerTexte(s, regles, 'projet', 'prix', '200000');
    expect(prix.projet.prix).toBe('200000');
    expect(prix.projet.fraisNotaire).toBe(estimerFraisNotaire(prix.projet, regles));
    expect(prix.projet.fraisNotaire).not.toBe(FRAIS_150K);
    const dep = appliquerTexte(prix, regles, 'projet', 'departement', '36');
    expect(Number(dep.projet.fraisNotaire)).toBeLessThan(Number(prix.projet.fraisNotaire));
    // Un prix illisible laisse le champ vide plutôt qu'un chiffre périmé.
    expect(appliquerTexte(s, regles, 'projet', 'prix', 'abc').projet.fraisNotaire).toBe('');
  });

  it('ne touche pas aux frais pour les autres champs ni quand ils sont « à toi »', () => {
    const travaux = appliquerTexte(s, regles, 'projet', 'travaux', '10000');
    expect(travaux.projet.travaux).toBe('10000');
    expect(travaux.projet.fraisNotaire).toBe(FRAIS_150K);
    const manuels = appliquerTexte(s, regles, 'projet', 'fraisNotaire', '9000');
    expect(manuels.projet.fraisNotaire).toBe('9000');
    const prixApres = appliquerTexte(manuels, regles, 'projet', 'prix', '200000');
    expect(prixApres.projet.fraisNotaire).toBe('9000');
    // « Ré-estimer » remet l'estimation ; sans prix lisible, rien ne change.
    expect(reestimerFraisNotaire(prixApres, regles).projet.fraisNotaire).toBe(
      estimerFraisNotaire(prixApres.projet, regles),
    );
    const illisible = appliquerTexte(manuels, regles, 'projet', 'prix', 'abc');
    expect(reestimerFraisNotaire(illisible, regles)).toBe(illisible);
  });

  it('modifie l’offre visée seulement ; une offre B absente est ignorée', () => {
    const a = appliquerTexte(s, regles, 'a', 'tauxNominal', '3,3');
    expect(a.offres[0].tauxNominal).toBe('3,3');
    expect(a.offres[1]?.tauxNominal).toBe('3.27');
    const b = appliquerTexte(a, regles, 'b', 'dureeAnnees', '25');
    expect(b.offres[0].dureeAnnees).toBe('20');
    expect(b.offres[1]?.dureeAnnees).toBe('25');
    expect(b.projet).toBe(a.projet);
    const sansB = retirerOffreB(b);
    expect(sansB.offres[1]).toBeNull();
    expect(appliquerTexte(sansB, regles, 'b', 'dureeAnnees', '15')).toBe(sansB);
  });

  it('retire puis remet l’offre B, copiée sur A sans son nom', () => {
    const a = appliquerTexte(s, regles, 'a', 'nom', 'LCL');
    const remise = ajouterOffreB(retirerOffreB(a));
    expect(remise.offres[1]).toEqual({ ...a.offres[0], nom: '' });
    expect(remise.offres[0].nom).toBe('LCL');
  });
});

describe('versSimulation', () => {
  const s = saisieDefaut(regles);
  const avecA = (cle: string, texte: string): Saisie => appliquerTexte(s, regles, 'a', cle, texte);

  it('accepte virgule ou point décimal, espaces, et convertit les pourcentages', () => {
    const c = versSimulation(
      appliquerTexte(avecA('tauxNominal', '3,3'), regles, 'a', 'apport', '15 000'),
    );
    expect(c.erreurs).toEqual({});
    expect(c.offres[0]).toMatchObject({ tauxNominal: 0.033, apport: 15_000 });
  });

  it('signale un champ illisible, un obligatoire vide, une valeur hors bornes, un différé trop long', () => {
    expect(versSimulation(avecA('tauxNominal', 'abc')).erreurs).toEqual({
      'a.tauxNominal': 'Pourcentage attendu, par exemple 3,35.',
    });
    expect(versSimulation(avecA('dureeAnnees', '')).erreurs).toEqual({
      'a.dureeAnnees': 'Cette valeur est nécessaire au calcul.',
    });
    expect(versSimulation(avecA('dureeAnnees', '2,5')).erreurs).toEqual({
      'a.dureeAnnees': 'Nombre entier attendu.',
    });
    expect(versSimulation(avecA('dureeAnnees', '40')).erreurs).toEqual({
      'a.dureeAnnees': 'Au plus 30 ans.',
    });
    // Zod vérifie la cohérence du différé avant la borne du champ : le message du refine l'emporte.
    expect(versSimulation(avecA('differeTotalMois', '300')).erreurs).toEqual({
      'a.differeTotalMois': 'Le différé doit être plus court que le prêt',
    });
    expect(versSimulation(avecA('differePartielMois', '40')).erreurs).toEqual({
      'a.differePartielMois': 'Au plus 36 mois.',
    });
    const long = appliquerTexte(
      appliquerTexte(avecA('dureeAnnees', '3'), regles, 'a', 'differeTotalMois', '20'),
      regles,
      'a',
      'differePartielMois',
      '16',
    );
    expect(versSimulation(long).erreurs).toEqual({
      'a.differeTotalMois': 'Le différé doit être plus court que le prêt',
    });
    expect(versSimulation(appliquerTexte(s, regles, 'projet', 'prix', '0')).erreurs).toEqual({
      'projet.prix': 'Prix positif attendu.',
    });
    expect(versSimulation(appliquerTexte(s, regles, 'projet', 'departement', '1')).erreurs).toEqual(
      { 'projet.departement': 'Deux ou trois caractères, par exemple 13 ou 2A.' },
    );
  });

  it('calcule A même si seule B est fausse, et rien si le projet ou A est faux', () => {
    const bFausse = versSimulation(appliquerTexte(s, regles, 'b', 'tauxNominal', 'x'));
    expect(bFausse.simulation).toBeNull();
    expect(bFausse.projet).not.toBeNull();
    expect(bFausse.offres[0]).not.toBeNull();
    expect(bFausse.offres[1]).toBeNull();
    expect(Object.keys(bFausse.erreurs)).toEqual(['b.tauxNominal']);

    const aFausse = versSimulation(avecA('tauxNominal', 'x'));
    expect(aFausse.simulation).toBeNull();
    expect(aFausse.offres[0]).toBeNull();
    expect(aFausse.offres[1]).not.toBeNull();

    const projetFaux = versSimulation(appliquerTexte(s, regles, 'projet', 'prix', ''));
    expect(projetFaux.simulation).toBeNull();
    expect(projetFaux.projet).toBeNull();
    // Sans prix, les frais de notaire estimés se vident aussi : deux champs obligatoires manquent.
    expect(projetFaux.erreurs).toEqual({
      'projet.prix': 'Cette valeur est nécessaire au calcul.',
      'projet.fraisNotaire': 'Cette valeur est nécessaire au calcul.',
    });
  });

  it('sans offre B, la simulation n’a qu’une offre', () => {
    const c = versSimulation(retirerOffreB(s));
    expect(c.simulation?.offres).toHaveLength(1);
    expect(c.offres[1]).toBeNull();
  });

  it('garde le nom saisi, coupé de ses espaces, et lit les revenus et le département', () => {
    const complete = appliquerTexte(
      appliquerTexte(
        appliquerTexte(s, regles, 'projet', 'revenusMensuels', '2400'),
        regles,
        'projet',
        'departement',
        '13',
      ),
      regles,
      'a',
      'nom',
      ' LCL ',
    );
    const c = versSimulation(complete);
    expect(c.projet).toMatchObject({ revenusMensuels: 2_400, departement: '13' });
    expect(c.offres[0]?.nom).toBe('LCL');
  });
});

describe('saisieDepuisSimulation', () => {
  it('rend les textes d’une simulation et fait l’aller-retour', () => {
    const s = appliquerTexte(saisieDefaut(regles), regles, 'a', 'nom', 'LCL');
    const simulation = versSimulation(s).simulation;
    expect(simulation).not.toBeNull();
    const retour = saisieDepuisSimulation(simulation!);
    expect(retour.projet).toEqual(s.projet);
    expect(retour.offres[0]).toEqual({ ...s.offres[0], nom: 'LCL' });
    expect(retour.offres[1]).toEqual({ ...s.offres[1], nom: 'Offre B' });
    expect(versSimulation(retour).simulation).toEqual(simulation);
  });

  it('laisse vides les champs absents et l’offre B quand il n’y en a qu’une', () => {
    const s = saisieDepuisSimulation({
      versionRegles: '2026-09',
      projet: { prix: 100_000, honorairesAgence: 0, travaux: 0, fraisNotaire: 8_000 },
      offres: [
        {
          nom: '',
          apport: 0,
          fraisDossier: 0,
          fraisGarantie: 0,
          fraisBancairesFinances: true,
          tauxNominal: 0.03,
          tauxAssurance: 0.0025,
          dureeAnnees: 20,
          differeTotalMois: 0,
          differePartielMois: 0,
        },
      ],
    });
    expect(s.projet.departement).toBe('');
    expect(s.projet.revenusMensuels).toBe('');
    expect(s.offres[0].fraisBancairesFinances).toBe('oui');
    expect(s.offres[1]).toBeNull();
  });

  it('refuse une simulation sans offre (impossible après Zod)', () => {
    expect(() =>
      saisieDepuisSimulation({
        versionRegles: '2026-09',
        projet: { prix: 1, honorairesAgence: 0, travaux: 0, fraisNotaire: 0 },
        offres: [],
      }),
    ).toThrow('Simulation sans offre');
  });
});
