import type { Cle } from '@/ecrans/formulaire/valeurs';
import type { CodeTerme } from '@/textes/glossaire';

/**
 * Une unité d'affichage du formulaire Vérifier : un champ, ou plusieurs chaînes de `Valeurs` qu'une seule
 * commande remplit (la commune = code postal + ville ; le loyer = les champs de loyer du type choisi).
 */
export type Item =
  | 'typeBien'
  | 'prix'
  | 'honorairesAgence'
  | 'surface'
  | 'commune'
  | 'pieces'
  | 'chambres'
  | 'etage'
  | 'ascenseur'
  | 'annee'
  | 'dpe'
  | 'ges'
  | 'etat'
  | 'exterieur'
  | 'venduLoue'
  | 'travaux'
  | 'mode'
  | 'loyer'
  | 'apport'
  | 'dureeAnnees'
  | 'tmi'
  | 'chargesCoproMois'
  | 'taxeFonciere'
  | 'lotsCopro'
  | 'coproEnProcedure';

export type CarteVerifier = 'bien' | 'location' | 'vous' | 'charges';

export interface DescriptionItem {
  readonly carte: CarteVerifier;
  /** Nom court, en minuscules, pour les résumés : « DPE, état, charges de copro… ». */
  readonly nom: string;
  readonly cles: readonly Cle[];
  readonly terme?: CodeTerme;
}

export const ITEMS: Readonly<Record<Item, DescriptionItem>> = {
  typeBien: { carte: 'bien', nom: 'type de bien', cles: ['typeBien'] },
  prix: { carte: 'bien', nom: 'prix', cles: ['prix'] },
  honorairesAgence: {
    carte: 'bien',
    nom: "honoraires d'agence",
    cles: ['honorairesAgence'],
    terme: 'honorairesAcquereur',
  },
  surface: { carte: 'bien', nom: 'surface', cles: ['surface'] },
  commune: { carte: 'bien', nom: 'commune', cles: ['codePostal', 'ville'] },
  pieces: { carte: 'bien', nom: 'pièces', cles: ['pieces'] },
  chambres: { carte: 'bien', nom: 'chambres', cles: ['chambres'] },
  etage: { carte: 'bien', nom: 'étage', cles: ['etage'] },
  ascenseur: { carte: 'bien', nom: 'ascenseur', cles: ['ascenseur'] },
  annee: { carte: 'bien', nom: 'année', cles: ['annee'], terme: 'anneeConstruction' },
  dpe: { carte: 'bien', nom: 'DPE', cles: ['dpe'], terme: 'dpe' },
  ges: { carte: 'bien', nom: 'GES', cles: ['ges'], terme: 'ges' },
  etat: { carte: 'bien', nom: 'état', cles: ['etat'] },
  exterieur: { carte: 'bien', nom: 'balcon ou terrasse', cles: ['exterieur'] },
  venduLoue: { carte: 'bien', nom: 'vendu loué', cles: ['venduLoue'], terme: 'venduLoue' },
  travaux: { carte: 'bien', nom: 'travaux', cles: ['travaux'] },
  mode: { carte: 'location', nom: 'type de location', cles: ['mode'] },
  loyer: {
    carte: 'location',
    nom: 'loyer visé',
    cles: ['loyerHc', 'chambresLouees', 'loyerChambre', 'nuitee', 'nuiteesParMois'],
    terme: 'loyerHc',
  },
  apport: { carte: 'vous', nom: 'apport', cles: ['apport'], terme: 'apport' },
  dureeAnnees: { carte: 'vous', nom: 'durée du prêt', cles: ['dureeAnnees'] },
  tmi: { carte: 'vous', nom: "tranche d'imposition", cles: ['tmi'], terme: 'tmi' },
  chargesCoproMois: {
    carte: 'charges',
    nom: 'charges de copro',
    cles: ['chargesCoproMois'],
    terme: 'chargesCopro',
  },
  taxeFonciere: { carte: 'charges', nom: 'taxe foncière', cles: ['taxeFonciere'] },
  lotsCopro: { carte: 'charges', nom: 'lots de copro', cles: ['lotsCopro'], terme: 'lotsCopro' },
  coproEnProcedure: {
    carte: 'charges',
    nom: 'copro en procédure',
    cles: ['coproEnProcedure'],
    terme: 'coproEnProcedure',
  },
};

/** L'ordre des champs dans leurs cartes. */
export const ORDRE_ITEMS: readonly Item[] = [
  'typeBien',
  'prix',
  'surface',
  'commune',
  'pieces',
  'chambres',
  'etage',
  'ascenseur',
  'etat',
  'dpe',
  'ges',
  'annee',
  'exterieur',
  'venduLoue',
  'honorairesAgence',
  'travaux',
  'mode',
  'loyer',
  'apport',
  'dureeAnnees',
  'tmi',
  'chargesCoproMois',
  'taxeFonciere',
  'lotsCopro',
  'coproEnProcedure',
];

export const TITRES_CARTES: Readonly<Record<CarteVerifier, string>> = {
  bien: 'Le bien',
  location: 'La location',
  vous: 'Vous',
  charges: 'Charges connues',
};

export const ORDRE_CARTES: readonly CarteVerifier[] = ['bien', 'location', 'vous', 'charges'];

/**
 * Les champs facultatifs, les plus influents d'abord : DPE et état pèsent sur l'estimation du prix,
 * charges et taxe foncière sur le cash-flow ; type de bien et extérieur ensuite.
 */
export const ORDRE_PRECISER: readonly Item[] = [
  'dpe',
  'etat',
  'chargesCoproMois',
  'taxeFonciere',
  'typeBien',
  'exterieur',
  'etage',
  'ascenseur',
  'venduLoue',
  'annee',
  'ges',
  'pieces',
  'chambres',
  'honorairesAgence',
  'travaux',
  'lotsCopro',
  'coproEnProcedure',
];

// Chaque clé de `Valeurs` appartient à un seul item (vérifié par les tests).
const ITEM_PAR_CLE = Object.fromEntries(
  ORDRE_ITEMS.flatMap((item) => ITEMS[item].cles.map((cle) => [cle, item])),
) as Readonly<Record<Cle, Item>>;

/** L'item qui affiche une clé de `Valeurs`. */
export function itemDeCle(cle: Cle): Item {
  return ITEM_PAR_CLE[cle];
}

/** Les termes expliqués par une ⓘ dans le formulaire Vérifier. */
export const TERMES_VERIFIER: readonly CodeTerme[] = [
  ...new Set(ORDRE_ITEMS.flatMap((item) => ITEMS[item].terme ?? [])),
];
