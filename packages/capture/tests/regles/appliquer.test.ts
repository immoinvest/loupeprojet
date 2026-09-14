import { describe, expect, it } from 'vitest';

import {
  LONGUEUR_MAX_DESCRIPTION,
  ReglesPortailSchema,
  appliquerRegles,
  capturer,
  type ReglesPortail,
} from '../../src';

function page(html: string): Document {
  return new DOMParser().parseFromString(
    `<!doctype html><html><head></head><body>${html}</body></html>`,
    'text/html',
  );
}

const REGLES: ReglesPortail = ReglesPortailSchema.parse({
  version: 'leboncoin-2026-09-13',
  portail: 'leboncoin',
  champs: {
    prix: [
      { source: 'jsonld', chemin: 'offers.price', type: 'montant' },
      { source: 'css', selecteur: '.prix', type: 'montant' },
    ],
    surface: [
      { source: 'meta', nom: 'og:title', regex: '(\\d+(?:,\\d+)?)\\s*m²', type: 'nombre' },
      { source: 'css', selecteur: '.surface', type: 'nombre' },
    ],
    pieces: [
      { source: 'css', selecteur: '.criteres li', regex: 'Pièces\\s+(\\d+)', type: 'entier' },
    ],
    etage: [{ source: 'css', selecteur: '.criteres li', regex: 'Étage\\s+(.+)', type: 'etage' }],
    ascenseur: [
      // Présence → constante : ne trouve rien ici (« Ascenseur Non »), on passe au suivant.
      {
        source: 'css',
        selecteur: '.criteres li',
        regex: '^sans\\s+ascenseur$',
        type: 'booleen',
        valeur: false,
      },
      { source: 'css', selecteur: '.criteres li', regex: 'Ascenseur\\s+(\\S+)', type: 'booleen' },
    ],
    dpe: [{ source: 'css', selecteur: '.dpe', type: 'classe' }],
    codePostal: [
      { source: 'jsonld', chemin: 'address.postalCode', typeLd: 'Product', type: 'codePostal' },
    ],
    ville: [{ source: 'jsonld', chemin: 'address.addressLocality', type: 'texte' }],
    chargesCopro: [{ source: 'css', selecteur: '.charges', type: 'montant', diviser: 12 }],
    description: [{ source: 'css', selecteur: '.description', type: 'texte' }],
    meuble: [
      { source: 'meta', nom: 'og:title', regex: 'meublé', type: 'booleen', valeur: true },
      {
        source: 'css',
        selecteur: '.criteres li',
        regex: '^meublé$',
        type: 'booleen',
        valeur: true,
      },
    ],
  },
});

const PAGE = `
<script type="application/ld+json">{"@type":"Product","offers":{"price":-5},"address":{"postalCode":"13005","addressLocality":"  Marseille "}}</script>
<meta property="og:title" content="Appartement 3 pièces 65,5 m² Marseille">
<div class="prix">155 000 €</div>
<div class="surface">64 m²</div>
<ul class="criteres"><li>Pièces 3</li><li>Étage Rez-de-chaussée</li><li>Ascenseur Non</li><li>Meublé</li></ul>
<span class="dpe">D</span>
<span class="charges">1 080 € / an</span>
<div class="description">Bel appartement.<br>Idéal investisseur.</div>`;

describe('appliquerRegles', () => {
  it('prend le premier extracteur qui donne une valeur valide, champ par champ', () => {
    expect(appliquerRegles(page(PAGE), REGLES)).toEqual({
      // Le prix JSON-LD est négatif (hors schéma) : on passe au sélecteur CSS.
      prix: 155_000,
      // La meta og:title répond avant le sélecteur CSS.
      surface: 65.5,
      pieces: 3,
      etage: 0,
      ascenseur: false,
      dpe: 'D',
      codePostal: '13005',
      ville: 'Marseille',
      chargesCopro: 90,
      description: 'Bel appartement.\nIdéal investisseur.',
      // « Meublé » trouvé dans la liste : la constante `valeur` s'applique.
      meuble: true,
    });
  });

  it('laisse absents les champs introuvables et ne lève jamais sur une page qui a changé', () => {
    expect(appliquerRegles(page('<p>La maquette a changé.</p>'), REGLES)).toEqual({});
  });

  it('lit photos, caractéristiques en tableau et dates dans l’état applicatif', () => {
    const regles = ReglesPortailSchema.parse({
      version: 'leboncoin-2026-09-14',
      portail: 'leboncoin',
      champs: {
        photos: [{ source: 'json', selecteur: '#etat', chemin: 'ad.images[*].url', type: 'urls' }],
        cave: [
          {
            source: 'json',
            selecteur: '#etat',
            chemin: 'ad.attributes[key=specificities].values',
            regex: '\\bcellar\\b',
            type: 'booleen',
            valeur: true,
          },
        ],
        parking: [
          {
            source: 'json',
            selecteur: '#etat',
            chemin: 'ad.attributes[key=specificities].values',
            regex: '\\bparking\\b',
            type: 'booleen',
            valeur: true,
          },
        ],
        publieeLe: [{ source: 'json', selecteur: '#etat', chemin: 'ad.publication', type: 'date' }],
      },
    });
    const etat = {
      ad: {
        images: [{ url: 'https://img.exemple.fr/1.jpg' }, { url: 'http://img.exemple.fr/2.jpg' }],
        attributes: [{ key: 'specificities', values: ['cellar', 'intercom'] }],
        publication: '2026-08-28 20:32:49',
      },
    };
    const document = page(
      `<script id="etat" type="application/json">${JSON.stringify(etat)}</script>`,
    );
    expect(appliquerRegles(document, regles)).toEqual({
      photos: ['https://img.exemple.fr/1.jpg'],
      cave: true,
      publieeLe: '2026-08-28',
    });
  });

  it('tronque la description à la longueur maximale', () => {
    const longue = `<div class="description">${'x'.repeat(LONGUEUR_MAX_DESCRIPTION + 500)}</div>`;
    expect(appliquerRegles(page(longue), REGLES).description).toHaveLength(
      LONGUEUR_MAX_DESCRIPTION,
    );
  });
});

describe('capturer', () => {
  const URL_ANNONCE = 'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851?utm_source=x';
  const MAINTENANT = new Date('2026-09-13T10:41:00.000Z');

  it('assemble une capture validée : portail, URL canonique, identifiant, champs, date, mode, version des règles', () => {
    expect(
      capturer(page(PAGE), URL_ANNONCE, REGLES, { mode: 'extension', maintenant: MAINTENANT }),
    ).toEqual({
      version: 1,
      portail: 'leboncoin',
      url: 'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851',
      id: '2214738851',
      prix: 155_000,
      surface: 65.5,
      pieces: 3,
      etage: 0,
      ascenseur: false,
      dpe: 'D',
      codePostal: '13005',
      ville: 'Marseille',
      chargesCopro: 90,
      description: 'Bel appartement.\nIdéal investisseur.',
      meuble: true,
      captureLe: '2026-09-13T10:41:00.000Z',
      mode: 'extension',
      regles: 'leboncoin-2026-09-13',
    });
  });

  it('date la capture à l’instant courant quand aucune date n’est fournie', () => {
    const avant = Date.now();
    const capture = capturer(page(PAGE), URL_ANNONCE, REGLES, { mode: 'bookmarklet' });
    expect(capture?.mode).toBe('bookmarklet');
    expect(Date.parse(capture?.captureLe ?? '')).toBeGreaterThanOrEqual(avant);
  });

  it('rend null si l’URL n’est pas une annonce, ou pas une annonce du portail des règles', () => {
    expect(
      capturer(page(PAGE), 'https://www.leboncoin.fr/recherche?category=9', REGLES, {
        mode: 'extension',
      }),
    ).toBeNull();
    expect(
      capturer(
        page(PAGE),
        'https://www.pap.fr/annonces/appartement-marseille-13005-r456789012',
        REGLES,
        {
          mode: 'extension',
        },
      ),
    ).toBeNull();
  });

  it('laisse tomber un identifiant hors schéma plutôt que d’échouer', () => {
    const reglesBienici = ReglesPortailSchema.parse({
      version: 'bienici-2026-09-13',
      portail: 'bienici',
      champs: { prix: [{ source: 'css', selecteur: '.prix', type: 'montant' }] },
    });
    const slug = `${'a'.repeat(150)}-123`;
    const capture = capturer(
      page(PAGE),
      `https://www.bienici.com/annonce/vente/marseille/appartement/${slug}`,
      reglesBienici,
      { mode: 'extension', maintenant: MAINTENANT },
    );
    expect(capture?.id).toBeUndefined();
    expect(capture?.prix).toBe(155_000);
  });
});
