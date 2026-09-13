export type TypeChamp = 'euros' | 'nombre' | 'entier' | 'pourcent' | 'bool' | 'enum' | 'texte';

export type Conversion =
  { readonly ok: true; readonly valeur: unknown } | { readonly ok: false; readonly erreur: string };

const nettoyer = (texte: string): string => texte.replace(/\s/g, '').replace(',', '.');

function primitif(valeur: unknown): string | number | boolean | null {
  return typeof valeur === 'string' || typeof valeur === 'number' || typeof valeur === 'boolean'
    ? valeur
    : null;
}

/** Valeur stockée → texte affiché dans le champ. Les taux sont montrés en pourcentage (0,0335 → « 3,35 »). */
export function versTexte(valeur: unknown, type: TypeChamp): string {
  const v = primitif(valeur);
  if (v === null) return '';
  switch (type) {
    case 'pourcent':
      return String(Math.round(Number(v) * 100 * 1000) / 1000);
    case 'bool':
      return v === true ? 'oui' : 'non';
    case 'euros':
    case 'nombre':
    case 'entier':
    case 'enum':
    case 'texte':
      return String(v);
  }
}

/** Texte saisi → valeur à stocker. Vide → `undefined` (le champ obligatoire est contrôlé ailleurs). */
export function depuisTexte(texte: string, type: TypeChamp): Conversion {
  const t = texte.trim();
  if (t === '') return { ok: true, valeur: undefined };
  switch (type) {
    case 'bool':
      return { ok: true, valeur: t === 'oui' };
    case 'enum':
    case 'texte':
      return { ok: true, valeur: t };
    case 'entier': {
      const n = Number(nettoyer(t));
      return Number.isInteger(n)
        ? { ok: true, valeur: n }
        : { ok: false, erreur: 'Nombre entier attendu.' };
    }
    case 'euros':
    case 'nombre': {
      const n = Number(nettoyer(t));
      return Number.isFinite(n)
        ? { ok: true, valeur: n }
        : { ok: false, erreur: 'Nombre attendu.' };
    }
    case 'pourcent': {
      const n = Number(nettoyer(t));
      return Number.isFinite(n)
        ? { ok: true, valeur: Math.round(n * 1000) / 100000 }
        : { ok: false, erreur: 'Pourcentage attendu, par exemple 3,35.' };
    }
  }
}
