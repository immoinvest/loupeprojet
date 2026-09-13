import { lireChemin } from './chemin';
import { appliquerRegex, normaliserTexte } from './convertir';
import type { Extracteur } from './schema';

function analyserJson(texte: string | null): unknown {
  if (texte === null) return undefined;
  try {
    return JSON.parse(texte) as unknown;
  } catch {
    return undefined;
  }
}

/** Tous les nœuds JSON-LD de la page : tableaux et `@graph` aplatis, blocs illisibles ignorés. */
function noeudsJsonLd(document: Document): unknown[] {
  const noeuds: unknown[] = [];
  const empiler = (valeur: unknown): void => {
    if (Array.isArray(valeur)) {
      valeur.forEach(empiler);
      return;
    }
    if (typeof valeur !== 'object' || valeur === null) return;
    noeuds.push(valeur);
    const graphe: unknown = (valeur as Record<string, unknown>)['@graph'];
    if (Array.isArray(graphe)) graphe.forEach(empiler);
  };
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    empiler(analyserJson(script.textContent));
  }
  return noeuds;
}

function aLeType(noeud: unknown, typeLd: string | undefined): boolean {
  if (typeLd === undefined) return true;
  const type: unknown = (noeud as Record<string, unknown>)['@type'];
  return Array.isArray(type) ? type.includes(typeLd) : type === typeLd;
}

function lireJsonLd(document: Document, chemin: string, typeLd: string | undefined): unknown {
  for (const noeud of noeudsJsonLd(document)) {
    if (!aLeType(noeud, typeLd)) continue;
    const valeur = lireChemin(noeud, chemin);
    if (valeur !== undefined && valeur !== null) return valeur;
  }
  return undefined;
}

function selectionner(document: Document, selecteur: string): Element[] {
  try {
    return [...document.querySelectorAll(selecteur)];
  } catch {
    return [];
  }
}

const BLOCS = new Set([
  'BR',
  'P',
  'LI',
  'DIV',
  'H1',
  'H2',
  'H3',
  'H4',
  'TR',
  'UL',
  'OL',
  'TABLE',
  'SECTION',
  'ARTICLE',
]);

/**
 * Texte d'un élément : sauts de ligne autour des blocs et aux `<br>`, une espace devant chaque
 * élément en ligne (« <span>Surface</span><span>65 m²</span> » → « Surface 65 m² »), scripts et
 * styles ignorés. Travaille sur une copie : la page n'est pas modifiée.
 */
export function texteVisible(element: Element): string {
  const copie = element.cloneNode(true) as Element;
  for (const cache of copie.querySelectorAll('script, style, noscript')) cache.remove();
  for (const enfant of copie.querySelectorAll('*')) {
    if (BLOCS.has(enfant.tagName)) {
      enfant.prepend('\n');
      enfant.append('\n');
    } else {
      enfant.prepend(' ');
    }
  }
  return normaliserTexte(copie.textContent);
}

function lireCss(
  document: Document,
  selecteur: string,
  attribut: string | undefined,
  regex: string | undefined,
): string | undefined {
  for (const element of selectionner(document, selecteur)) {
    const brut = attribut === undefined ? texteVisible(element) : element.getAttribute(attribut);
    if (brut === null || brut === '') continue;
    const valeur = appliquerRegex(brut, regex);
    if (valeur !== undefined) return valeur;
  }
  return undefined;
}

/** La valeur brute que désigne un extracteur dans le document, ou `undefined`. Ne lève jamais. */
export function lireSource(document: Document, extracteur: Extracteur): unknown {
  switch (extracteur.source) {
    case 'jsonld':
      return lireJsonLd(document, extracteur.chemin, extracteur.typeLd);
    case 'json':
      return lireChemin(
        analyserJson(selectionner(document, extracteur.selecteur)[0]?.textContent ?? null),
        extracteur.chemin,
      );
    case 'meta':
      return (
        selectionner(
          document,
          `meta[property="${extracteur.nom}"], meta[name="${extracteur.nom}"]`,
        )[0]?.getAttribute('content') ?? undefined
      );
    case 'css':
      return lireCss(document, extracteur.selecteur, extracteur.attribut, extracteur.regex);
  }
}
