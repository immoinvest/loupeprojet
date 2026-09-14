import { describe, expect, it } from 'vitest';

import { ExtracteurSchema, ReglesPortailSchema, creerRegistre } from '../../src';

const LBC = {
  version: 'leboncoin-2026-09-13',
  portail: 'leboncoin',
  champs: { prix: [{ source: 'css', selecteur: '.prix', type: 'montant' }] },
};
const PAP = {
  version: 'pap-2026-09-13',
  portail: 'pap',
  champs: { prix: [{ source: 'jsonld', chemin: 'offers.price', type: 'montant' }] },
};

describe('creerRegistre', () => {
  it('indexe les règles par portail et expose leurs versions', () => {
    const registre = creerRegistre([LBC, PAP]);
    expect(registre.reglesDuPortail('pap')?.version).toBe('pap-2026-09-13');
    expect(registre.reglesDuPortail('seloger')).toBeUndefined();
    expect(registre.versions()).toEqual({
      leboncoin: 'leboncoin-2026-09-13',
      pap: 'pap-2026-09-13',
    });
  });

  it('refuse un fichier invalide et deux fichiers pour le même portail', () => {
    expect(() => creerRegistre([{ version: 'lbc', portail: 'leboncoin', champs: {} }])).toThrow();
    expect(() => creerRegistre([LBC, { ...LBC, version: 'leboncoin-2026-10-01' }])).toThrow(
      /Deux fichiers de règles pour le portail leboncoin/,
    );
  });
});

describe('ReglesPortailSchema', () => {
  it('exige une version <portail>-AAAA-MM-JJ cohérente avec le portail', () => {
    expect(ReglesPortailSchema.safeParse({ ...LBC, version: 'seloger-2026-09-13' }).success).toBe(
      false,
    );
    expect(ReglesPortailSchema.safeParse({ ...LBC, version: 'leboncoin-v2' }).success).toBe(false);
    expect(ReglesPortailSchema.safeParse({ ...LBC, portail: 'figaro' }).success).toBe(false);
  });

  it('refuse un champ inconnu, une liste vide et un extracteur mal formé', () => {
    expect(
      ReglesPortailSchema.safeParse({ ...LBC, champs: { telephone: LBC.champs.prix } }).success,
    ).toBe(false);
    expect(ReglesPortailSchema.safeParse({ ...LBC, champs: { prix: [] } }).success).toBe(false);
    expect(
      ReglesPortailSchema.safeParse({
        ...LBC,
        champs: { prix: [{ source: 'texte', selecteur: '.prix', type: 'montant' }] },
      }).success,
    ).toBe(false);
  });

  it('valide les options d’un extracteur : regex compilable, chemin sans espace, noms sûrs', () => {
    const css = { source: 'css', selecteur: '.prix', type: 'montant' };
    expect(ExtracteurSchema.safeParse({ ...css, regex: '(\\d+' }).success).toBe(false);
    expect(ExtracteurSchema.safeParse({ ...css, regex: '(\\d+)' }).success).toBe(true);
    expect(ExtracteurSchema.safeParse({ ...css, attribut: 'data-id' }).success).toBe(true);
    expect(ExtracteurSchema.safeParse({ ...css, attribut: 'on click' }).success).toBe(false);
    expect(ExtracteurSchema.safeParse({ ...css, type: 'heure' }).success).toBe(false);
    expect(ExtracteurSchema.safeParse({ ...css, type: 'date' }).success).toBe(true);
    expect(ExtracteurSchema.safeParse({ ...css, type: 'urls' }).success).toBe(true);
    expect(ExtracteurSchema.safeParse({ ...css, diviser: 0 }).success).toBe(false);
    expect(ExtracteurSchema.safeParse({ ...css, valeur: false }).success).toBe(true);
    expect(ExtracteurSchema.safeParse({ ...css, valeur: { oui: 1 } }).success).toBe(false);
    expect(
      ExtracteurSchema.safeParse({ source: 'jsonld', chemin: '', type: 'montant' }).success,
    ).toBe(false);
    expect(
      ExtracteurSchema.safeParse({
        source: 'jsonld',
        chemin: 'additionalProperty[name=Nombre de pièces].value',
        type: 'entier',
      }).success,
    ).toBe(true);
    expect(
      ExtracteurSchema.safeParse({ source: 'meta', nom: 'og:title"]', type: 'texte' }).success,
    ).toBe(false);
    expect(
      ExtracteurSchema.safeParse({
        source: 'json',
        selecteur: '#__NEXT_DATA__',
        chemin: 'props.pageProps.ad.attributes[key=square].value',
        type: 'nombre',
      }).success,
    ).toBe(true);
  });
});
