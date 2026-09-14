import {
  OffrePretSchema,
  ProjetFinanceSchema,
  obtenirRegles,
  simulerPret,
  type OffrePret,
} from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import {
  EN_TETE_CSV,
  LIBELLES_PHASES,
  centimes,
  csvAmortissement,
  nomFichierCsv,
  slug,
} from '@/simulateur';

const regles = obtenirRegles('2026-09');
const projet = ProjetFinanceSchema.parse({ prix: 155_000, fraisNotaire: 0 });
const lcl: OffrePret = OffrePretSchema.parse({
  nom: 'LCL',
  tauxNominal: 0.033,
  dureeAnnees: 25,
  tauxAssurance: 0.0037,
});

describe('csvAmortissement', () => {
  const r = simulerPret(projet, lcl, regles);
  const csv = csvAmortissement(r);
  const lignes = csv.slice(1).split('\r\n');

  it('commence par le BOM UTF-8 puis l’en-tête, séparé par des points-virgules', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(lignes[0]).toBe(
      'Mois;Année;Phase;Capital restant dû début;Intérêts;Capital remboursé;Mensualité hors assurance;Assurance;Mensualité totale;Capital restant dû fin',
    );
    expect(lignes[0]).toBe(EN_TETE_CSV.join(';'));
  });

  it('a une ligne par mois, au centime, avec la virgule décimale (155 000 € à 3,3 % sur 25 ans)', () => {
    expect(lignes[1]).toBe(
      '1;1;Amortissement;155000,00;426,25;333,19;759,44;47,79;807,23;154666,81',
    );
    expect(lignes[300]?.startsWith('300;25;Amortissement;')).toBe(true);
    expect(lignes[300]?.endsWith(';0,00')).toBe(true);
    // 300 mois + en-tête + totaux, chaque ligne terminée par CRLF (le dernier morceau est vide).
    expect(lignes).toHaveLength(303);
    expect(lignes[302]).toBe('');
    for (const ligne of lignes.slice(0, 302)) expect(ligne.split(';')).toHaveLength(10);
    expect(csv.includes('\n')).toBe(true);
    expect(csv.replace(/\r\n/g, '').includes('\n')).toBe(false);
  });

  it('termine par les totaux', () => {
    const totaux = lignes[301]?.split(';');
    expect(totaux?.slice(0, 4)).toEqual(['Totaux', '', '', '']);
    expect(totaux?.[4]).toBe(centimes(r.totalInterets));
    expect(totaux?.[5]).toBe('155000,00');
    expect(totaux?.[6]).toBe(centimes(r.mensualiteHorsAssurance * 300));
    expect(totaux?.[7]).toBe(centimes(r.totalAssurance));
    expect(totaux?.[8]).toBe(centimes(r.totalMensualites));
    expect(totaux?.[9]).toBe('0,00');
  });

  it('nomme les phases d’un différé, sans point-virgule', () => {
    const differe = simulerPret(
      projet,
      OffrePretSchema.parse({
        tauxNominal: 0.033,
        dureeAnnees: 25,
        differeTotalMois: 12,
        differePartielMois: 6,
      }),
      regles,
    );
    const l = csvAmortissement(differe).split('\r\n');
    expect(l[1]?.split(';')[2]).toBe('Différé total');
    expect(l[13]?.split(';')[2]).toBe('Différé partiel');
    expect(l[19]?.split(';')[2]).toBe('Amortissement');
    // Différé total : mensualité nulle, capital nul, CRD qui grossit.
    expect(l[1]?.split(';').slice(5, 8)).toEqual([
      '0,00',
      '0,00',
      centimes(differe.assuranceMensuelle),
    ]);
    expect(Object.values(LIBELLES_PHASES).some((p) => p.includes(';'))).toBe(false);
  });

  it('rend l’en-tête et des totaux à zéro quand il n’y a rien à emprunter', () => {
    const rien = simulerPret(projet, OffrePretSchema.parse({ ...lcl, apport: 200_000 }), regles);
    expect(csvAmortissement(rien)).toBe(
      `${String.fromCharCode(0xfeff)}${EN_TETE_CSV.join(';')}\r\nTotaux;;;;0,00;0,00;0,00;0,00;0,00;0,00\r\n`,
    );
  });
});

describe('centimes, slug et nom de fichier', () => {
  it('arrondit au centime avec la virgule, sans « −0 »', () => {
    expect(centimes(1234.5)).toBe('1234,50');
    expect(centimes(0.005)).toBe('0,01');
    expect(centimes(-0.001)).toBe('0,00');
    expect(centimes(-12.346)).toBe('-12,35');
    expect(centimes(0)).toBe('0,00');
  });

  it('transforme un nom de banque en identifiant de fichier', () => {
    expect(slug("Crédit Agricole d'Île-de-France")).toBe('credit-agricole-d-ile-de-france');
    expect(slug('  LCL  ')).toBe('lcl');
    expect(slug('!!!')).toBe('');
  });

  it('nomme le fichier avec la banque, la durée et le taux à deux décimales', () => {
    expect(nomFichierCsv(lcl)).toBe('deklic-amortissement-lcl-25-ans-3-30.csv');
    expect(nomFichierCsv({ ...lcl, nom: 'Offre A', tauxNominal: 0.0327, dureeAnnees: 20 })).toBe(
      'deklic-amortissement-offre-a-20-ans-3-27.csv',
    );
    expect(nomFichierCsv({ ...lcl, nom: '' })).toBe('deklic-amortissement-offre-25-ans-3-30.csv');
    expect(nomFichierCsv({ ...lcl, nom: '???', tauxNominal: 0 })).toBe(
      'deklic-amortissement-offre-25-ans-0-00.csv',
    );
  });
});
