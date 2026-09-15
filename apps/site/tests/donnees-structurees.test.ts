import { describe, expect, it } from 'vitest';

import {
  application,
  article,
  auteur,
  faq,
  filAriane,
  graphe,
  organisation,
  serialiserJsonLd,
  siteWeb,
} from '../src/lib/donnees-structurees';

const SEPARATEUR_LIGNE = String.fromCharCode(0x2028);
const SEPARATEUR_PARAGRAPHE = String.fromCharCode(0x2029);

describe('données structurées', () => {
  it('décrit l’organisation, le site et l’application gratuite, sans note ni avis', () => {
    expect(organisation()).toMatchObject({ '@type': 'Organization', url: 'https://deklic.pro/' });
    expect(siteWeb()).toMatchObject({ '@type': 'WebSite', inLanguage: 'fr-FR' });
    const app = application('https://app.deklic.pro');
    expect(app).toMatchObject({
      '@type': 'SoftwareApplication',
      url: 'https://app.deklic.pro',
      offers: { price: '0', priceCurrency: 'EUR' },
    });
    expect(JSON.stringify(app)).not.toMatch(/Rating|Review/);
  });

  it('décrit un guide : auteur, dates au format ISO, page principale', () => {
    const noeud = article({
      titre: 'LMNP ou location nue',
      description: 'Quel régime paie le moins ?',
      chemin: '/guides/lmnp-ou-location-nue/',
      publieLe: new Date('2026-09-15'),
      misAJourLe: new Date('2026-09-20'),
    });
    expect(noeud).toMatchObject({
      '@type': 'Article',
      datePublished: '2026-09-15',
      dateModified: '2026-09-20',
      author: auteur(),
      mainEntityOfPage: 'https://deklic.pro/guides/lmnp-ou-location-nue/',
    });
    expect(auteur()).toMatchObject({ name: 'Pierre Georgel' });
  });

  it('reprend la FAQ et le fil d’Ariane dans l’ordre', () => {
    expect(faq([{ question: 'Q ?', reponse: 'R.' }])).toEqual({
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'Q ?', acceptedAnswer: { '@type': 'Answer', text: 'R.' } },
      ],
    });
    expect(
      filAriane([
        { nom: 'Accueil', chemin: '/' },
        { nom: 'Guides', chemin: '/guides/' },
      ]),
    ).toMatchObject({
      itemListElement: [
        { position: 1, name: 'Accueil', item: 'https://deklic.pro/' },
        { position: 2, name: 'Guides', item: 'https://deklic.pro/guides/' },
      ],
    });
  });

  it('sérialise sans permettre de fermer la balise script', () => {
    const reponse = `a${SEPARATEUR_LIGNE}b${SEPARATEUR_PARAGRAPHE}c`;
    const texte = serialiserJsonLd(
      graphe([faq([{ question: '</script><script>alert(1)</script>', reponse }])]),
    );
    expect(texte).not.toContain('<');
    expect(texte).not.toContain(SEPARATEUR_LIGNE);
    expect(texte).not.toContain(SEPARATEUR_PARAGRAPHE);
    expect(JSON.parse(texte)).toMatchObject({
      '@context': 'https://schema.org',
      '@graph': [{ mainEntity: [{ acceptedAnswer: { text: reponse } }] }],
    });
  });
});
