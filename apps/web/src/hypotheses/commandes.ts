import type { BornesCompteur } from '@/composants/saisie/pas';
import { nombre, pourcentage } from '@/formatage/nombres';

import type { Descripteur } from './types';

/** La commande d'un champ d'hypothèse, la même que dans le formulaire Vérifier. */
export type TypeCommande =
  | 'montant'
  | 'compteur'
  | 'ouiNon'
  | 'tuiles'
  | 'energie'
  | 'annee'
  | 'duree'
  | 'apport'
  | 'curseur'
  | 'taux'
  | 'texte';

export type ReglageCommande =
  | { readonly type: 'montant'; readonly decimales: number }
  | {
      readonly type: 'compteur';
      readonly bornes: BornesCompteur;
      readonly moins: string;
      readonly plus: string;
      /** Texte à côté de la valeur 0 (« RDC ») ; rien si absent. */
      readonly libelleZero: string | undefined;
    }
  | { readonly type: 'ouiNon' | 'tuiles'; readonly effacable: boolean }
  | { readonly type: 'energie'; readonly variante: 'dpe' | 'ges' }
  | { readonly type: 'annee' | 'duree' | 'apport' | 'curseur' | 'taux' | 'texte' };

/** Un montant peut porter des centimes (charges, frais) : ils ne sont jamais tronqués à la saisie. */
export const DECIMALES_MONTANT = 2;

/** Bornes des boutons − / + sans réglage propre ; la saisie au clavier reste libre. */
export const BORNES_PAR_DEFAUT: BornesCompteur = { min: 0, max: 999 };

/** Le curseur des nuits louées : un mois compté 30 jours, comme dans le moteur. */
export const CURSEUR_NUITS = { min: 0, max: 30, pas: 1 } as const;

/** La commande déduite de la nature du champ : `euros` → montant, `entier` → compteur, `bool` → oui / non… */
function commandeParDefaut(d: Descripteur): TypeCommande {
  // Un oui / non aux libellés propres (« Au comptant », « Financés ») garde ses options en tuiles.
  if (d.options !== undefined) return 'tuiles';
  if (d.type === 'bool') return 'ouiNon';
  switch (d.type) {
    case 'euros':
    case 'nombre':
      return 'montant';
    case 'entier':
      return 'compteur';
    case 'pourcent':
      return 'taux';
    case 'enum':
    case 'texte':
      return 'texte';
  }
}

/** Le réglage complet de la commande d'un descripteur : déclarée (`commande`) ou déduite. */
export function commandeDe(d: Descripteur): ReglageCommande {
  const type = d.commande ?? commandeParDefaut(d);
  switch (type) {
    case 'montant':
      return { type, decimales: DECIMALES_MONTANT };
    case 'compteur':
      return {
        type,
        bornes: d.bornes ?? BORNES_PAR_DEFAUT,
        // Le libellé n'est pas repris : `getByLabelText('Durée')` doit trouver la saisie, pas ses boutons.
        moins: 'Un de moins',
        plus: 'Un de plus',
        libelleZero: d.libelleZero,
      };
    case 'ouiNon':
    case 'tuiles':
      return { type, effacable: d.obligatoire !== true };
    case 'energie':
      return { type, variante: d.chemin.endsWith('.ges') ? 'ges' : 'dpe' };
    case 'annee':
    case 'duree':
    case 'apport':
    case 'curseur':
    case 'taux':
    case 'texte':
      return { type };
  }
}

/** « 20 nuits · 67 % d'occupation » : la valeur du curseur des nuits louées. */
export function texteNuits(nuits: number): string {
  const occupation = pourcentage(nuits / CURSEUR_NUITS.max, 0);
  return `${nombre(nuits, Number.isInteger(nuits) ? 0 : 1)} nuits · ${occupation} d'occupation`;
}

/** Un libellé d'option commence par une majuscule sur une tuile (« à rénover » → « À rénover »). */
export function libelleTuile(libelle: string): string {
  return libelle.charAt(0).toLocaleUpperCase('fr-FR') + libelle.slice(1);
}
