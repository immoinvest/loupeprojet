import { describe, expect, it } from 'vitest';

import { convertir, normaliserTexte } from '../../src';

const INSECABLE = String.fromCharCode(0xa0);
const INSECABLE_FINE = String.fromCharCode(0x20_2f);

describe('convertir', () => {
  it('texte : normalise les espaces, garde les sauts de ligne, ignore le vide et les objets', () => {
    expect(convertir(`  Appartement ${INSECABLE} T3\n\n  lumineux `, 'texte')).toBe(
      'Appartement T3\nlumineux',
    );
    expect(convertir('   ', 'texte')).toBeUndefined();
    expect(convertir(65, 'texte')).toBe('65');
    expect(convertir(true, 'texte')).toBe('true');
    expect(convertir({ prix: 1 }, 'texte')).toBeUndefined();
    expect(convertir(null, 'texte')).toBeUndefined();
    expect(convertir(undefined, 'texte')).toBeUndefined();
  });

  it('montant : espaces et points séparent les milliers, la virgule est décimale', () => {
    expect(convertir('155 000 €', 'montant')).toBe(155_000);
    expect(convertir('Prix : 155.000,50 € FAI', 'montant')).toBe(155_000.5);
    expect(convertir(`1${INSECABLE_FINE}050€`, 'montant')).toBe(1_050);
    expect(convertir(`155${INSECABLE}000 €`, 'montant')).toBe(155_000);
    expect(convertir('90 € / mois', 'montant')).toBe(90);
    expect(convertir(155000, 'montant')).toBe(155_000);
    expect(convertir('Nous consulter', 'montant')).toBeUndefined();
  });

  it('nombre : le premier nombre, virgule ou point décimal', () => {
    expect(convertir('65,5 m²', 'nombre')).toBe(65.5);
    expect(convertir('65.5', 'nombre')).toBe(65.5);
    expect(convertir(65.5, 'nombre')).toBe(65.5);
    expect(convertir('m²', 'nombre')).toBeUndefined();
  });

  it('entier et étage : « 3e étage » → 3, « rez-de-chaussée » et « RDC » → 0', () => {
    expect(convertir('3e étage', 'entier')).toBe(3);
    expect(convertir('aucun', 'entier')).toBeUndefined();
    expect(convertir('Rez-de-chaussée', 'etage')).toBe(0);
    expect(convertir('RDC surélevé', 'etage')).toBe(0);
    expect(convertir('4ème étage', 'etage')).toBe(4);
    expect(convertir('dernier', 'etage')).toBeUndefined();
  });

  it('booleen : oui/non, true/false, 1/0, et les booléens tels quels', () => {
    expect(convertir(true, 'booleen')).toBe(true);
    expect(convertir(false, 'booleen')).toBe(false);
    expect(convertir('Oui', 'booleen')).toBe(true);
    expect(convertir('non', 'booleen')).toBe(false);
    expect(convertir('1', 'booleen')).toBe(true);
    expect(convertir(0, 'booleen')).toBe(false);
    expect(convertir('peut-être', 'booleen')).toBeUndefined();
  });

  it('classe : une lettre A–G, seule ou isolée en majuscule dans un texte', () => {
    expect(convertir('D', 'classe')).toBe('D');
    expect(convertir(' d ', 'classe')).toBe('D');
    expect(convertir('Classe énergie : C', 'classe')).toBe('C');
    expect(convertir('il y a des travaux', 'classe')).toBeUndefined();
    expect(convertir('NS', 'classe')).toBeUndefined();
    expect(convertir('H', 'classe')).toBeUndefined();
  });

  it('codePostal : cinq chiffres exactement', () => {
    expect(convertir('13005 Marseille', 'codePostal')).toBe('13005');
    expect(convertir('Marseille (13005)', 'codePostal')).toBe('13005');
    expect(convertir('123456', 'codePostal')).toBeUndefined();
    expect(convertir('1300', 'codePostal')).toBeUndefined();
  });

  it('regex : groupe 1 s’il existe, sinon la correspondance entière ; rien sans correspondance', () => {
    expect(convertir('Surface habitable : 65 m²', 'nombre', { regex: '(\\d+)\\s*m²' })).toBe(65);
    expect(convertir('Étage 3/5', 'texte', { regex: '\\d+/\\d+' })).toBe('3/5');
    expect(convertir('Étage 3/5', 'entier', { regex: 'ascenseur' })).toBeUndefined();
  });

  it('tableau de valeurs simples : lu comme un texte joint, pour qu’une regex y trouve une caractéristique', () => {
    expect(convertir(['cellar', 'intercom'], 'texte')).toBe('cellar, intercom');
    expect(convertir(['cellar', 'intercom'], 'booleen', { regex: 'intercom' })).toBeUndefined();
    expect(convertir(['cellar', 'intercom'], 'texte', { regex: '\\bintercom\\b' })).toBe(
      'intercom',
    );
    expect(convertir([3, true], 'texte')).toBe('3, true');
    expect(convertir([], 'texte')).toBeUndefined();
    expect(convertir([{ a: 1 }], 'texte')).toBeUndefined();
  });

  it('urls : adresses https dans l’ordre, sans doublon, 30 au plus ; le reste est écarté', () => {
    const https = 'https://img.exemple.fr/1.jpg';
    expect(convertir(https, 'urls')).toEqual([https]);
    expect(
      convertir(
        [
          ` ${https} `,
          'http://img.exemple.fr/2.jpg',
          'javascript:alert(1)',
          'pas une adresse',
          https,
          42,
          { url: https },
          `https://img.exemple.fr/${'a'.repeat(500)}`,
          'https://img.exemple.fr/3.jpg',
        ],
        'urls',
        { regex: 'ignoré', diviser: 2 },
      ),
    ).toEqual([https, 'https://img.exemple.fr/3.jpg']);
    const quarante = Array.from({ length: 40 }, (_, i) => `https://i.fr/${String(i)}.jpg`);
    expect(convertir(quarante, 'urls')).toEqual(quarante.slice(0, 30));
    expect(convertir(['http://a.fr/1.jpg'], 'urls')).toBeUndefined();
    expect(convertir(undefined, 'urls')).toBeUndefined();
  });

  it('date : AAAA-MM-JJ trouvée dans le texte, date impossible refusée', () => {
    expect(convertir('2026-08-28 20:32:49', 'date')).toBe('2026-08-28');
    expect(convertir('2026-06-29T08:59:00Z', 'date')).toBe('2026-06-29');
    expect(convertir('DPE réalisé le 2025-03-12.', 'date')).toBe('2025-03-12');
    expect(convertir('2026-02-30', 'date')).toBeUndefined();
    expect(convertir('2026-13-01', 'date')).toBeUndefined();
    expect(convertir('hier', 'date')).toBeUndefined();
    expect(convertir(20260828, 'date')).toBeUndefined();
  });

  it('diviser : ramène des charges annuelles au mois, sans toucher aux textes', () => {
    expect(convertir('1 080 € / an', 'montant', { diviser: 12 })).toBe(90);
    expect(convertir('1 080 € / an', 'texte', { diviser: 12 })).toBe('1 080 € / an');
  });
});

describe('normaliserTexte', () => {
  it('compacte espaces et sauts de ligne', () => {
    expect(normaliserTexte(` a ${INSECABLE} b \n \n c `)).toBe('a b\nc');
  });
});
