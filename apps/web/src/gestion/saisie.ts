import {
  CreationLocationSchema,
  depotParDefaut,
  JOUR_LOYER_DEFAUT,
  JOUR_LOYER_MAX,
  JourSchema,
  MONTANT_MAX_CENTIMES,
  periodeDe,
  type CreationLocation,
  type NouveauBien,
  type NouvelleLocation,
  type TypeBien,
  type TypeLocation,
} from '@loupe/gestion';
import { z } from 'zod';

/** L'écran « Ajouter à la main » tel que tapé : du texte, lu et vérifié au moment de créer. */
export interface SaisieMain {
  readonly adresse: string;
  readonly type: TypeLocation;
  readonly loyer: string;
  readonly charges: string;
  /** « Prénom Nom » ; vide avec l'e-mail vide : le bien est créé vacant. */
  readonly locataire: string;
  readonly email: string;
  /** AAAA-MM-JJ (champ date du navigateur). */
  readonly entree: string;
  // « Plus de détails » : vides, ils prennent les valeurs par défaut.
  readonly jourLoyer: string;
  readonly depot: string;
  readonly typeBien: TypeBien;
  readonly surface: string;
}

export type ChampSaisie =
  | 'adresse'
  | 'loyer'
  | 'charges'
  | 'locataire'
  | 'email'
  | 'entree'
  | 'jourLoyer'
  | 'depot'
  | 'surface';

export type ResultatSaisie =
  | { readonly ok: true; readonly creation: CreationLocation }
  | { readonly ok: false; readonly erreurs: readonly ChampSaisie[] };

const SURFACE_MAX = 10_000;
const LONGUEUR_NOM_BIEN = 80;
const EmailSchema = z.email().max(254);

/** Une saisie vide : meublée, appartement, entrée le 1er du mois en cours (un locataire déjà en place). */
export function saisieInitiale(aujourdhui: string): SaisieMain {
  return {
    adresse: '',
    type: 'meublee',
    loyer: '',
    charges: '',
    locataire: '',
    email: '',
    entree: `${periodeDe(aujourdhui)}-01`,
    jourLoyer: '',
    depot: '',
    typeBien: 'appartement',
    surface: '',
  };
}

/** « 650 », « 650,50 », « 650.5 », « 1 300 € » → centimes ; `null` si illisible ou hors limites. */
export function centimesDepuisTexte(texte: string): number | null {
  const nettoye = texte.replace(/[\s€]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(nettoye)) return null;
  const centimes = Math.round(Number(nettoye) * 100);
  return centimes > MONTANT_MAX_CENTIMES ? null : centimes;
}

/** « Jean-Pierre de La Tour » → prénom « Jean-Pierre », nom « de La Tour » ; un seul mot ne suffit pas. */
export function decouperNom(texte: string): { prenom: string; nom: string } | null {
  const mots = texte.trim().split(/\s+/);
  const nom = mots.slice(1).join(' ');
  // Un texte vide ou d'un seul mot n'a pas de nom ; au-delà, le premier mot est forcément non vide.
  return nom === '' ? null : { prenom: mots.slice(0, 1).join(''), nom };
}

/** Le nom court du bien : l'adresse jusqu'à la première virgule. */
function nomDuBien(adresse: string): string {
  return adresse.split(',', 1).join('').trim().slice(0, LONGUEUR_NOM_BIEN);
}

function lireBien(s: SaisieMain, erreurs: ChampSaisie[]): NouveauBien {
  const adresse = s.adresse.trim();
  if (adresse === '') erreurs.push('adresse');
  const bien: NouveauBien = {
    nom: nomDuBien(adresse),
    adresse,
    type: s.typeBien,
    meuble: s.type === 'meublee',
  };
  if (s.surface.trim() === '') return bien;
  const surface = Number(s.surface.replace(',', '.'));
  if (!(surface > 0 && surface <= SURFACE_MAX)) erreurs.push('surface');
  return { ...bien, surface };
}

function lireJourLoyer(texte: string, erreurs: ChampSaisie[]): number {
  if (texte.trim() === '') return JOUR_LOYER_DEFAUT;
  const jour = Number(texte);
  if (!Number.isInteger(jour) || jour < 1 || jour > JOUR_LOYER_MAX) erreurs.push('jourLoyer');
  return jour;
}

/** Un montant facultatif : vide → valeur par défaut ; illisible → erreur sur le champ. */
function lireMontant(
  texte: string,
  defaut: number,
  champ: ChampSaisie,
  erreurs: ChampSaisie[],
): number {
  if (texte.trim() === '') return defaut;
  const centimes = centimesDepuisTexte(texte);
  if (centimes === null) erreurs.push(champ);
  return centimes ?? 0;
}

function lireLocation(s: SaisieMain, erreurs: ChampSaisie[]): NouvelleLocation {
  const loyer = centimesDepuisTexte(s.loyer);
  if (loyer === null) erreurs.push('loyer');
  const loyerHorsCharges = loyer ?? 0;
  if (!JourSchema.safeParse(s.entree).success) erreurs.push('entree');
  return {
    type: s.type,
    debut: s.entree,
    jourLoyer: lireJourLoyer(s.jourLoyer, erreurs),
    loyerHorsCharges,
    charges: lireMontant(s.charges, 0, 'charges', erreurs),
    depot: lireMontant(s.depot, depotParDefaut(s.type, loyerHorsCharges), 'depot', erreurs),
  };
}

function lireLocataire(
  s: SaisieMain,
  erreurs: ChampSaisie[],
): { prenom: string; nom: string; email?: string } {
  const nom = decouperNom(s.locataire);
  if (nom === null) erreurs.push('locataire');
  const email = s.email.trim();
  if (email !== '' && !EmailSchema.safeParse(email).success) erreurs.push('email');
  const identite = nom ?? { prenom: '', nom: '' };
  return email === '' ? identite : { ...identite, email };
}

/**
 * La création à envoyer, ou la liste des champs à corriger (dans l'ordre de l'écran). Sans locataire
 * ni e-mail, le bien est créé vacant ; sinon dépôt au maximum légal et loyer le 5, sauf précision.
 */
export function creationDepuisSaisie(s: SaisieMain): ResultatSaisie {
  const erreurs: ChampSaisie[] = [];
  const bien = lireBien(s, erreurs);
  const vacant = s.locataire.trim() === '' && s.email.trim() === '';
  const location = vacant ? null : lireLocation(s, erreurs);
  const locataire = vacant ? null : lireLocataire(s, erreurs);
  if (erreurs.length > 0) return { ok: false, erreurs };
  return { ok: true, creation: CreationLocationSchema.parse({ bien, locataire, location }) };
}
