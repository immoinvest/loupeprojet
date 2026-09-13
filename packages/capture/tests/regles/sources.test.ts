import { describe, expect, it } from 'vitest';

import { lireSource, texteVisible } from '../../src';

function page(html: string): Document {
  return new DOMParser().parseFromString(
    `<!doctype html><html><head></head><body>${html}</body></html>`,
    'text/html',
  );
}

const JSON_LD = `
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"T3 Marseille","offers":{"@type":"Offer","price":155000,"priceCurrency":"EUR"},"description":null}</script>
<script type="application/ld+json">[{"@type":["Apartment","Accommodation"],"floorSize":{"value":65}},"une chaîne",42,null]</script>
<script type="application/ld+json">{"@graph":[{"@type":"PostalAddress","postalCode":"13005","addressLocality":"Marseille"}]}</script>
<script type="application/ld+json">{ceci n'est pas du JSON</script>
`;

describe('lireSource · jsonld', () => {
  it('lit un chemin dans le premier nœud qui le porte, tableaux et @graph compris', () => {
    const doc = page(JSON_LD);
    expect(lireSource(doc, { source: 'jsonld', chemin: 'offers.price', type: 'montant' })).toBe(
      155000,
    );
    expect(lireSource(doc, { source: 'jsonld', chemin: 'floorSize.value', type: 'nombre' })).toBe(
      65,
    );
    expect(lireSource(doc, { source: 'jsonld', chemin: 'postalCode', type: 'codePostal' })).toBe(
      '13005',
    );
  });

  it('filtre par @type, chaîne ou tableau, et ignore les valeurs null', () => {
    const doc = page(JSON_LD);
    expect(
      lireSource(doc, { source: 'jsonld', chemin: 'name', typeLd: 'Product', type: 'texte' }),
    ).toBe('T3 Marseille');
    expect(
      lireSource(doc, { source: 'jsonld', chemin: 'name', typeLd: 'Offer', type: 'texte' }),
    ).toBeUndefined();
    expect(
      lireSource(doc, {
        source: 'jsonld',
        chemin: 'floorSize.value',
        typeLd: 'Accommodation',
        type: 'nombre',
      }),
    ).toBe(65);
    expect(
      lireSource(doc, { source: 'jsonld', chemin: 'description', type: 'texte' }),
    ).toBeUndefined();
  });

  it('rend undefined sans bloc JSON-LD', () => {
    expect(
      lireSource(page('<p>rien</p>'), { source: 'jsonld', chemin: 'name', type: 'texte' }),
    ).toBeUndefined();
  });
});

describe('lireSource · json', () => {
  const NEXT = `<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"ad":{"attributes":[{"key":"square","value":"65"}]}}}}</script>
<script id="casse">{pas du json</script>`;

  it('lit l’état applicatif d’un script et suit le chemin', () => {
    expect(
      lireSource(page(NEXT), {
        source: 'json',
        selecteur: '#__NEXT_DATA__',
        chemin: 'props.pageProps.ad.attributes[key=square].value',
        type: 'nombre',
      }),
    ).toBe('65');
  });

  it('rend undefined si le script manque, est illisible, ou si le sélecteur est invalide', () => {
    const doc = page(NEXT);
    expect(
      lireSource(doc, { source: 'json', selecteur: '#absent', chemin: 'props', type: 'texte' }),
    ).toBeUndefined();
    expect(
      lireSource(doc, { source: 'json', selecteur: '#casse', chemin: 'props', type: 'texte' }),
    ).toBeUndefined();
    expect(
      lireSource(doc, { source: 'json', selecteur: '[[[', chemin: 'props', type: 'texte' }),
    ).toBeUndefined();
  });
});

describe('lireSource · meta', () => {
  const META = `<meta property="og:title" content="Appartement 3 pièces 65 m²">
<meta name="description" content="Marseille 5e">
<meta property="og:image">`;

  it('lit `property` ou `name`, rend undefined sans balise ou sans contenu', () => {
    const doc = page(META);
    expect(lireSource(doc, { source: 'meta', nom: 'og:title', type: 'texte' })).toBe(
      'Appartement 3 pièces 65 m²',
    );
    expect(lireSource(doc, { source: 'meta', nom: 'description', type: 'texte' })).toBe(
      'Marseille 5e',
    );
    expect(lireSource(doc, { source: 'meta', nom: 'og:url', type: 'texte' })).toBeUndefined();
    expect(lireSource(doc, { source: 'meta', nom: 'og:image', type: 'texte' })).toBeUndefined();
  });
});

describe('lireSource · css', () => {
  const HTML = `
<div data-qa-id="adview_price"><span>155 000 €</span></div>
<ul class="criteres">
  <li data-qa-id="criteria_item_rooms"><span>Pièces</span><span>3</span></li>
  <li data-qa-id="criteria_item_floor"><span>Étage</span><span>3e étage</span></li>
  <li data-qa-id="criteria_item_square"><span>Surface</span><span>65 m²</span></li>
</ul>
<a class="lien" href="/plan">plan</a>
<a class="lien" data-id="ag13-1"></a>
<span class="vide">   </span>
<div class="description"><p>Appartement T3 <b>lumineux</b>.</p>Au 3e étage<br>sans ascenseur.<script>var x = 1;</script><style>.a{}</style></div>`;

  it('lit le texte visible du premier élément, ou un attribut', () => {
    const doc = page(HTML);
    expect(
      lireSource(doc, { source: 'css', selecteur: '[data-qa-id="adview_price"]', type: 'montant' }),
    ).toBe('155 000 €');
    expect(
      lireSource(doc, { source: 'css', selecteur: 'a.lien', attribut: 'href', type: 'texte' }),
    ).toBe('/plan');
    expect(
      lireSource(doc, { source: 'css', selecteur: 'a.lien', attribut: 'data-id', type: 'texte' }),
    ).toBe('ag13-1');
  });

  it('avec une regex, prend le premier élément dont le texte correspond', () => {
    const doc = page(HTML);
    expect(
      lireSource(doc, {
        source: 'css',
        selecteur: '.criteres li',
        regex: 'Surface\\s+([\\d,]+)\\s*m²',
        type: 'nombre',
      }),
    ).toBe('65');
    expect(
      lireSource(doc, {
        source: 'css',
        selecteur: '.criteres li',
        regex: 'Ascenseur',
        type: 'texte',
      }),
    ).toBeUndefined();
  });

  it('rend undefined sans élément, avec un texte vide, un attribut absent ou un sélecteur invalide', () => {
    const doc = page(HTML);
    expect(lireSource(doc, { source: 'css', selecteur: '.absent', type: 'texte' })).toBeUndefined();
    expect(lireSource(doc, { source: 'css', selecteur: '.vide', type: 'texte' })).toBeUndefined();
    expect(
      lireSource(doc, { source: 'css', selecteur: 'a.lien', attribut: 'title', type: 'texte' }),
    ).toBeUndefined();
    expect(lireSource(doc, { source: 'css', selecteur: '[[[', type: 'texte' })).toBeUndefined();
  });

  it('texteVisible : sauts de ligne aux paragraphes et aux <br>, scripts ignorés, page intacte', () => {
    const doc = page(HTML);
    const description = doc.querySelector('.description');
    expect(description).not.toBeNull();
    expect(texteVisible(description!)).toBe(
      'Appartement T3 lumineux.\nAu 3e étage\nsans ascenseur.',
    );
    expect(description!.querySelectorAll('p, script, style').length).toBe(3);
    expect(description!.textContent).not.toContain('\n');
    expect(texteVisible(doc.querySelector('.criteres')!)).toBe(
      'Pièces 3\nÉtage 3e étage\nSurface 65 m²',
    );
  });
});
