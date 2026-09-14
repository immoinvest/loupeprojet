import { euros, nombre, pourcentage } from '@/formatage/nombres';

import { versTexte } from './conversion';
import type { Descripteur } from './types';

/** « 14 337 » + « € » → « 14 337 € » ; « 980 » + « €/mois » → « 980 €/mois » ; « 25 » + « ans » → « 25 ans ». */
function avecUnite(texte: string, unite: string | undefined, symbole: string): string {
  if (unite === undefined) return texte;
  if (symbole !== '' && unite.startsWith(symbole)) return `${texte}${unite.slice(symbole.length)}`;
  return `${texte} ${unite}`;
}

/**
 * Valeur d'une hypothèse en texte lisible, pour un document : « 14 337 € », « 3,35 % »,
 * « 25 ans », « oui », « Meublé longue durée » ; « — » quand elle manque.
 */
export function texteLisible(d: Descripteur, valeur: unknown): string {
  if (valeur === undefined || valeur === null) return '—';
  if (d.options !== undefined) {
    const brut = versTexte(valeur, d.type);
    return d.options.find((o) => o.v === brut)?.l ?? brut;
  }
  switch (d.type) {
    case 'euros':
      return avecUnite(euros(Number(valeur)), d.unite, '€');
    case 'pourcent':
      return avecUnite(pourcentage(Number(valeur), 2), d.unite, '%');
    case 'entier':
      return avecUnite(nombre(Number(valeur)), d.unite, '');
    case 'nombre':
      return avecUnite(nombre(Number(valeur), Number.isInteger(valeur) ? 0 : 1), d.unite, '');
    case 'bool':
      return valeur === true ? 'oui' : 'non';
    case 'enum':
    case 'texte':
      return versTexte(valeur, d.type);
  }
}
