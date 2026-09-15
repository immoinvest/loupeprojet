import { describe, expect, it } from 'vitest';

import { texteEnTetes } from '../src/lib/verification/en-tetes';
import { cheminDepuisFichier, verifierPage } from '../src/lib/verification/pages';

const ORIGINE = 'https://deklic.pro';

function page(corps: string, tete = ''): string {
  return [
    '<!DOCTYPE html><html lang="fr"><head>',
    '<title>Calcul rentabilité locative : brut, net, net-net</title>',
    '<meta name="description" content="Comment calculer la rentabilité locative d&#39;un bien ? Formules et exemple chiffré.">',
    '<link rel="canonical" href="https://deklic.pro/guides/calcul/">',
    '<link rel="stylesheet" href="/_astro/site.css">',
    tete,
    '</head><body>',
    corps,
    '<script type="module" src="/_astro/simulateur.js"></script>',
    '</body></html>',
  ].join('');
}

const EXISTANTS = new Set([
  '/',
  '/guides/',
  '/guides/calcul/',
  '/_astro/site.css',
  '/_astro/simulateur.js',
]);

describe('cheminDepuisFichier', () => {
  it.each([
    ['index.html', '/'],
    ['guides\\calcul\\index.html', '/guides/calcul/'],
    ['/guides/index.html', '/guides/'],
    ['404.html', '/404.html'],
    ['rss.xml', '/rss.xml'],
  ])('%s → %s', (fichier, chemin) => {
    expect(cheminDepuisFichier(fichier)).toBe(chemin);
  });
});

describe('verifierPage', () => {
  it('accepte une page correcte', () => {
    const html = page(
      '<h1>Titre</h1><a href="/guides/">Guides</a><a href="/guides/calcul/#faq">FAQ</a><a href="https://www.service-public.gouv.fr/">Source</a>',
      '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article"}</script>',
    );
    expect(verifierPage({ chemin: '/guides/calcul/', html }, EXISTANTS, ORIGINE)).toEqual([]);
  });

  it('nomme chaque défaut, préfixé par la page', () => {
    const html = [
      '<html><head><title>',
      'x'.repeat(71),
      '</title><meta name="description" content="Trop court.">',
      '<link rel="canonical" href="https://loupeprojet.pages.dev/x/">',
      '<script type="application/ld+json">{pas du json</script>',
      '<script type="application/ld+json">{"@type":"AggregateRating"}</script>',
      '<script>alert(1)</script><style>p{}</style>',
      '</head><body><h1>Un</h1><h1>Deux</h1>',
      '<a href="/guides/absent/">x</a><img src="/absente.png" alt=""><a href="//ailleurs.example/">y</a>',
      '</body></html>',
    ].join('');
    expect(verifierPage({ chemin: '/x/', html }, EXISTANTS, ORIGINE)).toEqual([
      '/x/ : title trop long (71 caractères)',
      '/x/ : meta description de 11 caractères',
      '/x/ : canonique hors de https://deklic.pro (« https://loupeprojet.pages.dev/x/ »)',
      '/x/ : 2 titres H1 (un seul attendu)',
      '/x/ : données structurées illisibles',
      '/x/ : note ou avis dans les données structurées',
      '/x/ : script inline (refusé par la CSP)',
      '/x/ : style inline (refusé par la CSP)',
      '/x/ : lien interne cassé vers /guides/absent/',
      '/x/ : lien interne cassé vers /absente.png',
    ]);
  });

  it('signale une page sans title, sans description, sans canonique ni H1', () => {
    expect(verifierPage({ chemin: '/vide/', html: '<html></html>' }, EXISTANTS, ORIGINE)).toEqual([
      '/vide/ : balise title absente',
      '/vide/ : meta description de 0 caractères',
      '/vide/ : canonique absente',
      '/vide/ : 0 titres H1 (un seul attendu)',
    ]);
  });
});

describe('texteEnTetes', () => {
  it('limite le formulaire à l’application et interdit scripts tiers et cadrage', () => {
    const texte = texteEnTetes('https://app.deklic.pro');
    expect(texte).toContain("script-src 'self'");
    expect(texte).toContain('form-action https://app.deklic.pro;');
    expect(texte).toContain("frame-ancestors 'none'");
    expect(texte).toMatch(/^\/\*\n {2}Content-Security-Policy: /);
    expect(texte).toContain('/_astro/*\n  Cache-Control: public, max-age=31536000, immutable');
  });
});
