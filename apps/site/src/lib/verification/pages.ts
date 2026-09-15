/**
 * Vérification du HTML construit par Astro, page par page, à la fin du build : ce que Google lit
 * (title, description, canonique, un seul H1, données structurées), liens internes, et ce que la CSP
 * refuserait (script ou style inline). Le HTML vient d'Astro : un format connu, lu par expressions.
 */

export interface PageConstruite {
  /** Adresse de la page (« /guides/x/ », « /404.html »). */
  readonly chemin: string;
  readonly html: string;
}

const TITRE_MAX = 70;
const DESCRIPTION_MIN = 50;
const DESCRIPTION_MAX = 170;

/** « guides\\x\\index.html » → « /guides/x/ » ; « 404.html » → « /404.html ». */
export function cheminDepuisFichier(fichier: string): string {
  const avant = `/${fichier.replace(/\\/g, '/').replace(/^\/+/, '')}`;
  return avant.endsWith('/index.html') ? avant.slice(0, -'index.html'.length) : avant;
}

function decoder(texte: string): string {
  return texte
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function verifierEnTete(html: string, origine: string): string[] {
  const erreurs: string[] = [];
  const titre = decoder(/<title>([^<]*)<\/title>/.exec(html)?.[1]?.trim() ?? '');
  if (titre === '') erreurs.push('balise title absente');
  else if (titre.length > TITRE_MAX)
    erreurs.push(`title trop long (${String(titre.length)} caractères)`);

  const description = decoder(/<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? '');
  if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
    erreurs.push(`meta description de ${String(description.length)} caractères`);
  }

  const canonique = /<link rel="canonical" href="([^"]*)"/.exec(html)?.[1] ?? '';
  if (canonique === '') erreurs.push('canonique absente');
  else if (!canonique.startsWith(`${origine}/`)) {
    erreurs.push(`canonique hors de ${origine} (« ${canonique} »)`);
  }

  const h1 = html.match(/<h1[\s>]/g)?.length ?? 0;
  if (h1 !== 1) erreurs.push(`${String(h1)} titres H1 (un seul attendu)`);
  return erreurs;
}

function verifierScripts(html: string): string[] {
  const erreurs: string[] = [];
  for (const [, contenu = ''] of html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  )) {
    try {
      JSON.parse(contenu);
    } catch {
      erreurs.push('données structurées illisibles');
    }
    if (/"@type":"(AggregateRating|Review)"/.test(contenu)) {
      erreurs.push('note ou avis dans les données structurées');
    }
  }
  for (const [balise] of html.matchAll(/<script\b[^>]*>/g)) {
    if (!/\bsrc=/.test(balise) && !balise.includes('application/ld+json')) {
      erreurs.push('script inline (refusé par la CSP)');
    }
  }
  if (/<style[\s>]/.test(html)) erreurs.push('style inline (refusé par la CSP)');
  return erreurs;
}

function verifierLiens(html: string, existants: ReadonlySet<string>): string[] {
  const absents = new Set<string>();
  for (const [, cible = ''] of html.matchAll(/\b(?:href|src)="(\/(?!\/)[^"#?]*)/g)) {
    if (!existants.has(cible)) absents.add(cible);
  }
  return [...absents].map((cible) => `lien interne cassé vers ${cible}`);
}

/** Les défauts d'une page, chacun préfixé par son adresse ; vide si la page est correcte. */
export function verifierPage(
  page: PageConstruite,
  existants: ReadonlySet<string>,
  origine: string,
): string[] {
  return [
    ...verifierEnTete(page.html, origine),
    ...verifierScripts(page.html),
    ...verifierLiens(page.html, existants),
  ].map((erreur) => `${page.chemin} : ${erreur}`);
}
