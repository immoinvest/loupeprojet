import { describe, expect, it } from 'vitest';

import { pdfDocument } from '../src/courriels/pdf-quittance';
import {
  chainePdf,
  couperTexte,
  ecrirePdf,
  largeurTexte,
  octetWinAnsi,
} from '../src/courriels/pdf';
import { QUITTANCE } from './exemples-envois';

describe('encodage WinAnsi', () => {
  it('ASCII et Latin-1 tels quels, euro et apostrophe typographique à leur place, espaces fines en espace', () => {
    expect(octetWinAnsi('a')).toBe(0x61);
    expect(octetWinAnsi('é')).toBe(0xe9);
    expect(octetWinAnsi('€')).toBe(0x80);
    expect(octetWinAnsi('’')).toBe(0x92);
    expect(octetWinAnsi(String.fromCharCode(0x202f))).toBe(0x20);
    expect(octetWinAnsi('😀')).toBe(0x3f);
    expect(octetWinAnsi(String.fromCharCode(10))).toBe(0x3f);
  });

  it('chaîne littérale : parenthèses et barre inverse échappées, octets hauts en octal', () => {
    expect(chainePdf('(a\\b)')).toBe('(\\(a\\\\b\\))');
    expect(chainePdf('Reçu 70 €')).toBe('(Re\\347u 70 \\200)');
  });
});

describe('mise en ligne', () => {
  it('largeurs Helvetica ; une lettre accentuée a la largeur de sa base', () => {
    expect(largeurTexte('Hi', 10)).toBeCloseTo(((722 + 222) * 10) / 1000);
    expect(largeurTexte('é', 10)).toBe(largeurTexte('e', 10));
    expect(largeurTexte('€', 10)).toBe(5.56);
    expect(largeurTexte('ŉ', 1000)).toBe(556);
  });

  it('coupe aux espaces, garde un mot trop long seul', () => {
    expect(couperTexte('un deux trois', 10, 40)).toEqual(['un deux', 'trois']);
    expect(couperTexte('anticonstitutionnellement court', 10, 20)).toEqual([
      'anticonstitutionnellement',
      'court',
    ]);
    expect(couperTexte('  ', 10, 100)).toEqual([]);
  });
});

describe('fichier PDF', () => {
  it('table xref exacte, longueur du flux exacte, texte aligné à droite', () => {
    const pdf = ecrirePdf({
      textes: [
        { texte: 'Gauche', x: 60, y: 700, taille: 12 },
        { texte: '700 €', x: 535, y: 700, taille: 12, gras: true, aDroite: true },
      ],
      traits: [{ x1: 60, y1: 713, x2: 535.28, y2: 713 }],
    });
    expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
    expect(pdf.endsWith('%%EOF\n')).toBe(true);
    expect(/^[\x20-\x7e\n]*$/.test(pdf)).toBe(true);

    const debutXref = Number(/startxref\n(\d+)/.exec(pdf)?.[1]);
    expect(pdf.slice(debutXref, debutXref + 4)).toBe('xref');
    const positions = [...pdf.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(positions).toHaveLength(6);
    positions.forEach((position, rang) => {
      expect(pdf.slice(position).startsWith(`${String(rang + 1)} 0 obj`)).toBe(true);
    });

    const flux = /<< \/Length (\d+) >>\nstream\n([\s\S]*)\nendstream/.exec(pdf);
    expect(flux?.[2]?.length).toBe(Number(flux?.[1]));
    expect(pdf).toContain('0.8 G 0.6 w 60 713 m 535.28 713 l S');
    const x = Math.round((535 - largeurTexte('700 €', 12)) * 100) / 100;
    expect(pdf).toContain(`BT /F2 12 Tf ${String(x)} 700 Td (700 \\200) Tj ET`);
    expect(octetWinAnsi(String.fromCharCode(0xa0))).toBe(0x20);
    expect(pdf).toContain('BT /F1 12 Tf 60 700 Td (Gauche) Tj ET');
  });

  it('la quittance reprend le contenu figé : titre, montants, aide, colocataires, mentions', () => {
    const pdf = pdfDocument(QUITTANCE);
    for (const attendu of [
      '(Quittance de loyer)',
      '(N\\260 Q-202610-L1)',
      '(LOCATAIRES)',
      '(L\\351a Bernard)',
      '(Dont aide au logement vers\\351e par la CAF)',
      '(500 \\200)',
      '(400,50 \\200 le 20 octobre 2026)',
      '(Pour acquit.)',
      '(Fait le 2 novembre 2026.)',
    ]) {
      expect(pdf).toContain(attendu);
    }
    expect(pdf).not.toContain('Reste d');
    expect(pdf).toMatchSnapshot();
  });

  it('un reçu dit ce qui reste dû, sans aide ni mention', () => {
    const pdf = pdfDocument({
      ...QUITTANCE,
      type: 'recu',
      numero: 'R-202610-L1-P1',
      locataires: [{ prenom: 'Julie', nom: 'Martin' }],
      logement: { nom: 'T2 Lices', adresse: '12 rue des Lices' },
      apl: undefined,
      paiements: [{ montant: 30_000, date: '2026-10-06' }],
      montantRecu: 30_000,
      resteDu: 40_000,
      mentions: [],
    });
    expect(pdf).toContain('(Re\\347u de paiement)');
    expect(pdf).toContain('(LOCATAIRE)');
    expect(pdf).toContain('(Reste d\\373)');
    expect(pdf).toContain('(PAIEMENT RE\\307U)');
    expect(pdf).not.toContain('CAF');
  });
});
