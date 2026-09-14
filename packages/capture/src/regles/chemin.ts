/**
 * Lecture d'un chemin dans un objet JSON inconnu, sans jamais lever.
 * Syntaxe : `a.b.c`, `a[2].b`, `attributes[key=square].value`, `[0].prix`, et `photos[*].url`
 * qui applique la suite du chemin à chaque élément du tableau (liste des valeurs trouvées).
 */

type EtapeSimple =
  { readonly cle: string } | { readonly index: number } | { readonly ou: [string, string] };
type Etape = EtapeSimple | { readonly tous: true };

function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function analyserCrochet(interieur: string): Etape | null {
  if (interieur === '*') return { tous: true };
  if (/^\d+$/.test(interieur)) return { index: Number(interieur) };
  const egal = interieur.indexOf('=');
  if (egal <= 0) return null;
  return { ou: [interieur.slice(0, egal), interieur.slice(egal + 1)] };
}

function analyserSegment(segment: string): Etape[] | null {
  const m = /^([^[\]]*)((?:\[[^\]]+\])*)$/.exec(segment);
  if (m === null) return null;
  const nom = String(m[1]);
  const etapes: Etape[] = nom === '' ? [] : [{ cle: nom }];
  for (const crochet of String(m[2]).matchAll(/\[([^\]]+)\]/g)) {
    const etape = analyserCrochet(String(crochet[1]));
    if (etape === null) return null;
    etapes.push(etape);
  }
  return etapes;
}

function avancer(courant: unknown, etape: EtapeSimple): unknown {
  if ('cle' in etape) return estObjet(courant) ? courant[etape.cle] : undefined;
  if (!Array.isArray(courant)) return undefined;
  if ('index' in etape) return courant[etape.index] as unknown;
  const [cle, attendu] = etape.ou;
  return courant.find((element: unknown) => estObjet(element) && String(element[cle]) === attendu);
}

/** Projection `[*]` : la suite du chemin sur chaque élément ; les listes des projections suivantes sont aplaties. */
function projeter(tableau: readonly unknown[], suite: readonly Etape[]): unknown[] {
  const imbriquee = suite.some((etape) => 'tous' in etape);
  return tableau.flatMap((element) => {
    const lu = suivre(element, suite);
    if (lu === undefined) return [];
    return imbriquee && Array.isArray(lu) ? (lu as unknown[]) : [lu];
  });
}

function suivre(objet: unknown, etapes: readonly Etape[]): unknown {
  let courant: unknown = objet;
  for (const [position, etape] of etapes.entries()) {
    if ('tous' in etape) {
      return Array.isArray(courant) ? projeter(courant, etapes.slice(position + 1)) : undefined;
    }
    courant = avancer(courant, etape);
    if (courant === undefined) return undefined;
  }
  return courant;
}

/** Valeur au bout du chemin, ou `undefined` si une étape manque ou si le chemin est mal formé. */
export function lireChemin(objet: unknown, chemin: string): unknown {
  const etapes: Etape[] = [];
  for (const segment of chemin.split('.')) {
    const analysees = analyserSegment(segment);
    if (analysees === null) return undefined;
    etapes.push(...analysees);
  }
  return suivre(objet, etapes);
}
