import {
  COLOCATAIRES_MAX,
  NouvelleOccupationSchema,
  periodeDe,
  type LocationGeree,
  type NouvelleOccupation,
  type TypeLocation,
} from '@loupe/gestion';

import {
  decouperNom,
  lireLocataire,
  lireLocation,
  type ChampLocataire,
  type ChampLocation,
} from './saisie';

/** Le formulaire « Louer » d'un bien existant, tel que tapé. */
export interface SaisieLouer {
  readonly locataire: string;
  readonly email: string;
  /** « Prénom Nom » de chaque colocataire ; une ligne laissée vide est ignorée. */
  readonly colocataires: readonly string[];
  /** Location à la chambre : « Chambre 2 » ; vide pour le bien entier. */
  readonly libelle: string;
  readonly type: TypeLocation;
  readonly loyer: string;
  readonly charges: string;
  readonly entree: string;
  readonly jourLoyer: string;
  readonly depot: string;
  /** L'APL du nouveau locataire versée au bailleur ; vide : aucune. */
  readonly apl: string;
}

export type ChampLouer = ChampLocataire | 'colocataires' | 'libelle' | ChampLocation;

export type ResultatLouer =
  | { readonly ok: true; readonly occupation: NouvelleOccupation }
  | { readonly ok: false; readonly erreurs: readonly ChampLouer[] };

/** Même borne que le schéma de la location. */
export const LIBELLE_MAX = 40;

/** 65 000 centimes → « 650 » ; 65 050 → « 650,50 » : un montant tel qu'on le taperait. */
function enTexte(centimes: number): string {
  return centimes % 100 === 0
    ? String(centimes / 100)
    : (centimes / 100).toFixed(2).replace('.', ',');
}

/**
 * Le formulaire prérempli : type, loyer, charges et jour du loyer repris de la dernière location du
 * bien s'il y en a une (le dépôt reste au maximum légal, l'APL propre à chaque locataire reste vide) ;
 * entrée le 1er du mois en cours.
 */
export function saisieLouer(derniere: LocationGeree | undefined, aujourdhui: string): SaisieLouer {
  const commun = {
    locataire: '',
    email: '',
    colocataires: [],
    libelle: '',
    entree: `${periodeDe(aujourdhui)}-01`,
    depot: '',
    apl: '',
  };
  if (derniere === undefined) {
    return { ...commun, type: 'meublee', loyer: '', charges: '', jourLoyer: '' };
  }
  return {
    ...commun,
    type: derniere.type,
    loyer: enTexte(derniere.loyerHorsCharges),
    charges: enTexte(derniere.charges),
    jourLoyer: String(derniere.jourLoyer),
  };
}

/** L'occupation à envoyer, ou les champs à corriger dans l'ordre de l'écran. */
export function occupationDepuisSaisie(s: SaisieLouer): ResultatLouer {
  const erreurs: ChampLouer[] = [];
  const signaler = (champ: ChampLouer): void => {
    erreurs.push(champ);
  };
  const locataire = lireLocataire(s, signaler);
  const colocataires = s.colocataires.filter((nom) => nom.trim() !== '').map(decouperNom);
  if (colocataires.includes(null) || colocataires.length > COLOCATAIRES_MAX) {
    signaler('colocataires');
  }
  const libelle = s.libelle.trim();
  if (libelle.length > LIBELLE_MAX) signaler('libelle');
  const location = lireLocation(s, signaler);
  if (erreurs.length > 0) return { ok: false, erreurs };
  return {
    ok: true,
    occupation: NouvelleOccupationSchema.parse({
      locataire,
      location: libelle === '' ? location : { ...location, libelle },
      colocataires,
    }),
  };
}
