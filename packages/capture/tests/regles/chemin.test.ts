import { describe, expect, it } from 'vitest';

import { lireChemin } from '../../src';

const ETAT = {
  props: {
    pageProps: {
      ad: {
        list_id: 2214738851,
        price: [155000],
        attributes: [
          { key: 'square', value: '65', value_label: '65 m²' },
          { key: 'rooms', value: '3' },
          'un élément qui n’est pas un objet',
          { key: 'elevator', value: 1 },
        ],
        location: { city: 'Marseille', zipcode: '13005' },
      },
    },
  },
};

describe('lireChemin', () => {
  it('suit des clés, des index et des recherches [cle=valeur] dans les tableaux', () => {
    expect(lireChemin(ETAT, 'props.pageProps.ad.location.city')).toBe('Marseille');
    expect(lireChemin(ETAT, 'props.pageProps.ad.price[0]')).toBe(155000);
    expect(lireChemin(ETAT, 'props.pageProps.ad.attributes[key=square].value_label')).toBe('65 m²');
    expect(lireChemin(ETAT, 'props.pageProps.ad.attributes[1].value')).toBe('3');
    // La recherche compare des chaînes : `value=1` trouve la valeur numérique 1.
    expect(lireChemin(ETAT, 'props.pageProps.ad.attributes[value=1].key')).toBe('elevator');
    expect(lireChemin([{ prix: 1 }, { prix: 2 }], '[1].prix')).toBe(2);
    expect(
      lireChemin(
        { additionalProperty: [{ name: 'Nombre de pièces', value: 4 }] },
        'additionalProperty[name=Nombre de pièces].value',
      ),
    ).toBe(4);
    expect(lireChemin({ a: { b: 'c' } }, 'a..b')).toBe('c');
  });

  it('rend undefined quand une étape manque, sans jamais lever', () => {
    expect(lireChemin(ETAT, 'props.pageProps.ad.attributes[key=floor].value')).toBeUndefined();
    expect(lireChemin(ETAT, 'props.pageProps.annonce.prix')).toBeUndefined();
    expect(lireChemin(ETAT, 'props.pageProps.ad.location.city.nom')).toBeUndefined();
    expect(lireChemin(ETAT, 'props.pageProps.ad.location[0]')).toBeUndefined();
    expect(lireChemin(ETAT, 'props.pageProps.ad.price.montant')).toBeUndefined();
    expect(lireChemin(ETAT, 'props.pageProps.ad.price[7]')).toBeUndefined();
    expect(lireChemin(null, 'a')).toBeUndefined();
    expect(lireChemin('texte', 'length')).toBeUndefined();
  });

  it('rend undefined pour un chemin mal formé', () => {
    expect(lireChemin(ETAT, 'props[')).toBeUndefined();
    expect(lireChemin(ETAT, 'props[]')).toBeUndefined();
    expect(lireChemin(ETAT, 'props.pageProps.ad.attributes[=square]')).toBeUndefined();
    expect(lireChemin(ETAT, 'props.pageProps.ad.attributes[square]')).toBeUndefined();
  });
});
