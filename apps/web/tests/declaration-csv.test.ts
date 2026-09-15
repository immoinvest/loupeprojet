import type { Depense, LigneExport } from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import { celluleTexte, csvDeLAnnee, dateCsv, montantCsv } from '@/gestion/declaration/csv';

import { ETAT_SEPTEMBRE, HORODATAGE } from './gestion-exemples';

const BOM = String.fromCharCode(0xfeff);

function depense(champs: Partial<Depense>): Depense {
  return {
    id: 'd',
    categorie: 'assurance',
    montant: 1_200,
    date: '2026-09-10',
    recuperable: false,
    creeLe: HORODATAGE,
    modifieLe: HORODATAGE,
    ...champs,
  };
}

describe('export de l’année en CSV', () => {
  it('montants à virgule sans milliers, signe moins ; dates à la française', () => {
    expect(montantCsv(-84_050)).toBe('-840,50');
    expect(montantCsv(70_000)).toBe('700,00');
    expect(montantCsv(5)).toBe('0,05');
    expect(montantCsv(0)).toBe('0,00');
    expect(montantCsv(123_456_789)).toBe('1234567,89');
    expect(dateCsv('2026-03-05')).toBe('05/03/2026');
  });

  it('une cellule saisie ne devient jamais une formule ; séparateur et guillemets protégés', () => {
    expect(celluleTexte('Plombier')).toBe('Plombier');
    expect(celluleTexte('=SOMME(A1:A9)')).toBe("'=SOMME(A1:A9)");
    expect(celluleTexte('+33 6')).toBe("'+33 6");
    expect(celluleTexte('-2')).toBe("'-2");
    expect(celluleTexte('@cmd')).toBe("'@cmd");
    expect(celluleTexte('\tonglet')).toBe("'\tonglet");
    expect(celluleTexte('Fuite ; "cuisine"')).toBe('"Fuite ; ""cuisine"""');
    expect(celluleTexte('deux\nlignes')).toBe('"deux\nlignes"');
    expect(celluleTexte('=A1;B1')).toBe(`"'=A1;B1"`);
  });

  it('le texte exact : BOM, en-tête, une ligne par mouvement, CRLF', () => {
    const lignes: LigneExport[] = [
      {
        type: 'loyer',
        date: '2026-09-05',
        bienId: 'bien-lices',
        montant: 70_000,
        locationId: 'location-julie',
        periode: '2026-09',
      },
      {
        type: 'loyer',
        date: '2026-09-06',
        bienId: 'bien-inconnu',
        montant: 43_000,
        locationId: 'location-inconnue',
        periode: '2026-08',
      },
      {
        type: 'depense',
        date: '2026-09-10',
        bienId: null,
        montant: -1_200,
        depense: depense({ libelle: '=HYPERLINK("x")', recuperable: true }),
      },
      {
        type: 'depense',
        date: '2026-09-11',
        bienId: 'bien-baille',
        montant: -84_000,
        depense: depense({ bienId: 'bien-baille', categorie: 'taxe_fonciere' }),
      },
      {
        type: 'pret_interets',
        date: '2026-10-01',
        bienId: 'bien-lices',
        montant: -41_875,
        periode: '2026-10',
      },
      {
        type: 'pret_capital',
        date: '2026-10-01',
        bienId: 'bien-lices',
        montant: -32_119,
        periode: '2026-10',
      },
      {
        type: 'pret_assurance',
        date: '2026-10-01',
        bienId: 'bien-lices',
        montant: -3_125,
        periode: '2026-10',
      },
    ];
    expect(csvDeLAnnee(lignes, ETAT_SEPTEMBRE)).toBe(
      [
        `${BOM}Date;Bien;Catégorie;Libellé;Montant;Source`,
        '05/09/2026;T2 Lices;Loyer;Loyer de septembre 2026 · Julie Martin;700,00;Loyer reçu',
        '06/09/2026;;Loyer;Loyer d’août 2026;430,00;Loyer reçu',
        `10/09/2026;Tous les biens;Assurance;"'=HYPERLINK(""x"") · récupérable";-12,00;Dépense saisie`,
        '11/09/2026;Studio Baille;Taxe foncière;;-840,00;Dépense saisie',
        '01/10/2026;T2 Lices;Intérêts d’emprunt;Échéance d’octobre 2026;-418,75;Tableau d’amortissement',
        '01/10/2026;T2 Lices;Capital remboursé;Échéance d’octobre 2026;-321,19;Tableau d’amortissement',
        '01/10/2026;T2 Lices;Assurance emprunteur;Échéance d’octobre 2026;-31,25;Tableau d’amortissement',
        '',
      ].join('\r\n'),
    );
  });

  it('une année vide : l’en-tête seul', () => {
    expect(csvDeLAnnee([], ETAT_SEPTEMBRE)).toBe(
      `${BOM}Date;Bien;Catégorie;Libellé;Montant;Source\r\n`,
    );
  });
});
