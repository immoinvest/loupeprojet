import type { TypeBien, TypeLocation } from '@loupe/gestion';

import type { ChampSaisie } from '@/gestion/saisie';

/** Textes de l'écran « Ajouter à la main » (tutoiement). */
export const TEXTES_AJOUTER = {
  titre: 'Ajouter un bien loué',
  sous: 'Dépôt, jour du loyer et révision se règlent tout seuls. Tu pourras tout changer ensuite.',
  adresse: 'Adresse du bien',
  location: 'Location',
  loyer: 'Loyer',
  charges: 'Charges',
  locataire: 'Prénom et nom du locataire',
  email: 'E-mail du locataire',
  aideVacant: 'Laisse le locataire vide si le bien n’est pas loué.',
  entree: 'Date d’entrée',
  plusDeDetails: 'Plus de détails',
  jourLoyer: 'Jour du loyer',
  depot: 'Dépôt de garantie',
  typeBien: 'Type de bien',
  surface: 'Surface',
  creer: 'Créer',
  uniteLoyer: '€ hors charges',
  uniteCharges: '€ par mois',
  uniteEuros: '€',
  uniteSurface: 'm²',
  jourParDefaut: 'le 5 par défaut',
} as const;

export const LIBELLES_LOCATION: Readonly<Record<TypeLocation, string>> = {
  nue: 'Vide',
  meublee: 'Meublée',
};

export const LIBELLES_TYPE_BIEN: Readonly<Record<TypeBien, string>> = {
  appartement: 'Appartement',
  maison: 'Maison',
  studio: 'Studio',
  parking: 'Parking',
};

/** Le dépôt proposé quand le champ reste vide : le maximum légal du type de location. */
export const DEPOT_PAR_DEFAUT: Readonly<Record<TypeLocation, string>> = {
  nue: '1 mois de loyer par défaut',
  meublee: '2 mois de loyer par défaut',
};

/** Une phrase par champ à corriger : ce qui ne va pas et un exemple. */
export const ERREURS_SAISIE: Readonly<Record<ChampSaisie, string>> = {
  adresse: 'Indique l’adresse du bien.',
  loyer: 'Indique le loyer hors charges, par exemple 650.',
  charges: 'Les charges sont un montant, par exemple 50.',
  locataire: 'Indique le prénom et le nom, par exemple Julie Martin.',
  email: 'Cette adresse e-mail ne semble pas valide.',
  entree: 'Choisis la date d’entrée.',
  jourLoyer: 'Un jour entre 1 et 28.',
  depot: 'Le dépôt est un montant, par exemple 650.',
  surface: 'Une surface en m², par exemple 38.',
};
