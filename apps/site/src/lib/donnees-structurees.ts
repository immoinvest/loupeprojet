import { dateIso } from './formatage';
import { SITE, urlAbsolue } from './site';

/** Un nœud de données structurées schema.org. */
export type NoeudJsonLd = Readonly<Record<string, unknown>>;

const ID_ORGANISATION = `${SITE.origine}/#organisation`;

/** Séparateurs de ligne et de paragraphe Unicode : valides en JSON, gênants dans une balise script. */
const SEPARATEUR_LIGNE = String.fromCharCode(0x2028);
const SEPARATEUR_PARAGRAPHE = String.fromCharCode(0x2029);

export function organisation(): NoeudJsonLd {
  return {
    '@type': 'Organization',
    '@id': ID_ORGANISATION,
    name: SITE.nom,
    url: urlAbsolue('/'),
    logo: urlAbsolue('/apple-touch-icon.png'),
  };
}

export function siteWeb(): NoeudJsonLd {
  return {
    '@type': 'WebSite',
    '@id': `${SITE.origine}/#site`,
    name: SITE.nom,
    url: urlAbsolue('/'),
    inLanguage: SITE.langue,
    publisher: { '@id': ID_ORGANISATION },
  };
}

/** L'application, gratuite. Jamais de note ni d'avis : Deklic n'en a pas encore de vérifiables. */
export function application(origineApplication: string): NoeudJsonLd {
  return {
    '@type': 'SoftwareApplication',
    name: SITE.nom,
    url: origineApplication,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    inLanguage: SITE.langue,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    publisher: { '@id': ID_ORGANISATION },
  };
}

export function auteur(): NoeudJsonLd {
  return {
    '@type': 'Person',
    '@id': `${urlAbsolue(SITE.auteur.chemin)}#personne`,
    name: SITE.auteur.nom,
    url: urlAbsolue(SITE.auteur.chemin),
  };
}

export interface DonneesArticle {
  readonly titre: string;
  readonly description: string;
  readonly chemin: string;
  readonly publieLe: Date;
  readonly misAJourLe: Date;
}

export function article(donnees: DonneesArticle): NoeudJsonLd {
  return {
    '@type': 'Article',
    headline: donnees.titre,
    description: donnees.description,
    inLanguage: SITE.langue,
    datePublished: dateIso(donnees.publieLe),
    dateModified: dateIso(donnees.misAJourLe),
    author: auteur(),
    publisher: { '@id': ID_ORGANISATION },
    mainEntityOfPage: urlAbsolue(donnees.chemin),
    image: urlAbsolue('/og-image.png'),
  };
}

export function faq(questions: readonly { question: string; reponse: string }[]): NoeudJsonLd {
  return {
    '@type': 'FAQPage',
    mainEntity: questions.map(({ question, reponse }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: reponse },
    })),
  };
}

export function filAriane(etapes: readonly { nom: string; chemin: string }[]): NoeudJsonLd {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: etapes.map((etape, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: etape.nom,
      item: urlAbsolue(etape.chemin),
    })),
  };
}

/** Plusieurs nœuds dans un seul bloc. */
export function graphe(noeuds: readonly NoeudJsonLd[]): NoeudJsonLd {
  return { '@context': 'https://schema.org', '@graph': noeuds };
}

/**
 * JSON prêt pour `<script type="application/ld+json">` : « < » et les séparateurs de ligne Unicode
 * sont remplacés par leurs échappements JSON, un texte contenant « </script> » ne peut pas fermer la balise.
 */
export function serialiserJsonLd(donnees: NoeudJsonLd): string {
  return JSON.stringify(donnees)
    .replaceAll('<', '\\u003c')
    .replaceAll(SEPARATEUR_LIGNE, '\\u2028')
    .replaceAll(SEPARATEUR_PARAGRAPHE, '\\u2029');
}
