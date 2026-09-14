import {
  JOUR_LOYER_MAX,
  montantsDuMois,
  periodeDe,
  type LocationGeree,
  type ModificationLocation,
} from '@loupe/gestion';

import { centimesDepuisTexte } from './saisie';

/** Le formulaire « Modifier la location » tel que tapé. */
export interface SaisieModification {
  /** Le mois des nouveaux montants ; vide quand tous les mois sont déjà payés. */
  readonly aPartirDe: string;
  readonly loyer: string;
  readonly charges: string;
  readonly jourLoyer: string;
  readonly depot: string;
  /** La chambre ; vide pour un bien loué en entier. */
  readonly libelle: string;
}

export type ChampModification = 'loyer' | 'charges' | 'jourLoyer' | 'depot' | 'libelle';

export type ResultatModification =
  /** `modification` vaut `null` quand rien n'a changé : rien à envoyer. */
  | { readonly ok: true; readonly modification: ModificationLocation | null }
  | { readonly ok: false; readonly erreurs: readonly ChampModification[] };

const LONGUEUR_LIBELLE = 40;

/** 65 000 → « 650 », 65 005 → « 650,05 » : un montant tel qu'on le retape. */
export function texteDepuisCentimes(centimes: number): string {
  const euros = String(Math.trunc(centimes / 100));
  const reste = centimes % 100;
  return reste === 0 ? euros : `${euros},${String(reste).padStart(2, '0')}`;
}

/**
 * Le formulaire prérempli : montants en vigueur au premier mois proposé (ceux de ce mois-ci s'il n'y
 * en a pas), jour du loyer, dépôt, libellé.
 */
export function saisieModification(
  location: LocationGeree,
  mois: readonly string[],
  aujourdhui: string,
): SaisieModification {
  const [premier] = mois;
  const montants = montantsDuMois(location, premier ?? periodeDe(aujourdhui));
  return {
    aPartirDe: premier ?? '',
    loyer: texteDepuisCentimes(montants.loyerHorsCharges),
    charges: texteDepuisCentimes(montants.charges),
    jourLoyer: String(location.jourLoyer),
    depot: texteDepuisCentimes(location.depot),
    libelle: location.libelle ?? '',
  };
}

/**
 * Ce qu'il faut envoyer : seulement ce qui a changé (aucun changement de loyer inutile), ou les champs
 * à corriger dans l'ordre de l'écran. Sans mois proposé, loyer et charges ne sont ni lus ni envoyés.
 */
export function modificationDepuisSaisie(
  location: LocationGeree,
  s: SaisieModification,
): ResultatModification {
  const erreurs: ChampModification[] = [];
  const lireMontant = (texte: string, champ: ChampModification, siVide: number | null): number => {
    const centimes = texte.trim() === '' ? siVide : centimesDepuisTexte(texte);
    if (centimes === null) erreurs.push(champ);
    return centimes ?? 0;
  };
  const enVigueur = s.aPartirDe === '' ? null : montantsDuMois(location, s.aPartirDe);
  const loyer = enVigueur === null ? 0 : lireMontant(s.loyer, 'loyer', null);
  const charges = enVigueur === null ? 0 : lireMontant(s.charges, 'charges', 0);
  const jour = Number(s.jourLoyer);
  if (!Number.isInteger(jour) || jour < 1 || jour > JOUR_LOYER_MAX) erreurs.push('jourLoyer');
  const depot = lireMontant(s.depot, 'depot', null);
  const libelle = s.libelle.trim();
  if (libelle.length > LONGUEUR_LIBELLE) erreurs.push('libelle');
  if (erreurs.length > 0) return { ok: false, erreurs };

  const montantsChanges =
    enVigueur !== null && (enVigueur.loyerHorsCharges !== loyer || enVigueur.charges !== charges);
  const modification: ModificationLocation = {
    ...(montantsChanges
      ? {
          montants: {
            aPartirDe: s.aPartirDe,
            loyerHorsCharges: loyer,
            charges,
            apl: enVigueur.apl,
          },
        }
      : {}),
    ...(jour === location.jourLoyer ? {} : { jourLoyer: jour }),
    ...(depot === location.depot ? {} : { depot }),
    ...(libelle === (location.libelle ?? '') ? {} : { libelle: libelle === '' ? null : libelle }),
  };
  return { ok: true, modification: Object.keys(modification).length === 0 ? null : modification };
}

function normaliser(texte: string): string {
  return texte.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr');
}

/** « Supprimer ce bien » : le nom tapé est-il celui du bien ? (espaces et majuscules ignorés) */
export function nomConfirme(saisi: string, nom: string): boolean {
  return normaliser(saisi) === normaliser(nom);
}
