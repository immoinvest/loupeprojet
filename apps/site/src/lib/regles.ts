import { VERSION_REGLES_COURANTE, obtenirRegles, type Regles } from '@loupe/moteur';

import { euros, nombre, tauxRegle } from './formatage';

/** Les règles de calcul en vigueur, celles de l'application : un guide ne dit jamais autre chose. */
export const REGLES: Regles = obtenirRegles(VERSION_REGLES_COURANTE);

export type FormatRegle = 'euros' | 'taux' | 'nombre' | 'annees' | 'annee';

/**
 * Valeur numérique d'une règle par son chemin (« fiscalite.microBic.plafond »). Lève une erreur nommée
 * si le chemin n'existe pas ou ne mène pas à un nombre : le build du site échoue plutôt que d'afficher
 * un chiffre faux.
 */
export function valeurRegle(chemin: string, regles: Regles = REGLES): number {
  let courant: unknown = regles;
  for (const cle of chemin.split('.')) {
    courant =
      typeof courant === 'object' && courant !== null && Object.hasOwn(courant, cle)
        ? (courant as Readonly<Record<string, unknown>>)[cle]
        : undefined;
  }
  if (typeof courant !== 'number') {
    throw new Error(
      `Règle introuvable ou non numérique : « ${chemin} » (règles ${VERSION_REGLES_COURANTE})`,
    );
  }
  return courant;
}

/** La valeur est-elle marquée « à confirmer » dans les règles ? */
export function estAConfirmer(chemin: string, regles: Regles = REGLES): boolean {
  return regles.aConfirmer.includes(chemin);
}

/** Texte d'une règle : « 83 600 € », « 18,6 % », « 10 ans », « 2028 » (année, sans séparateur). */
export function texteRegle(chemin: string, format: FormatRegle, regles: Regles = REGLES): string {
  const valeur = valeurRegle(chemin, regles);
  switch (format) {
    case 'euros':
      return euros(valeur);
    case 'taux':
      return tauxRegle(valeur);
    case 'nombre':
      return nombre(valeur);
    case 'annees':
      return `${nombre(valeur)} ${valeur === 1 ? 'an' : 'ans'}`;
    case 'annee':
      return String(valeur);
  }
}
