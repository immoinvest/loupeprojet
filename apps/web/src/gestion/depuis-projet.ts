import {
  depotParDefaut,
  JOUR_LOYER_DEFAUT,
  periodeDe,
  periodeSuivante,
  type CreationLocation,
  type NouveauBien,
  type NouvelleLocation,
} from '@loupe/gestion';
import { z } from 'zod';

import type { ProjetEnregistre } from '@/stockage/projets';

import { decouperNom } from './saisie';

/** Ce que l'analyse permet de préremplir : le bien et la location, sans locataire. */
export interface Brouillon {
  readonly bien: NouveauBien;
  readonly location: NouvelleLocation;
}

export type ChampPret = 'adresse' | 'locataire' | 'email';

export type ResultatPret =
  | { readonly ok: true; readonly creation: CreationLocation }
  | { readonly ok: false; readonly erreurs: readonly ChampPret[] };

export interface SaisiePret {
  readonly adresse: string;
  readonly locataire: string;
  readonly email: string;
}

const LONGUEUR_NOM_BIEN = 80;
const EmailSchema = z.email().max(254);

/** Les montants du moteur sont en euros décimaux ; ceux de la gestion en centimes entiers (ADR-G2). */
function enCentimes(euros: number): number {
  return Math.round(euros * 100);
}

/**
 * Le bien et la location repris de l'analyse : type, surface, meublé ou vide, loyer et charges ;
 * par défaut, loyer le 5, entrée le 1er du mois suivant, dépôt au maximum légal. L'instantané des
 * entrées du projet est gardé pour comparer plus tard le réel au prévu.
 */
export function brouillonDepuisProjet(enregistre: ProjetEnregistre, aujourdhui: string): Brouillon {
  const { bien, hypotheses } = enregistre.projet;
  const meuble = hypotheses.location.mode !== 'nu';
  const type = meuble ? 'meublee' : 'nue';
  const loyerHorsCharges = enCentimes(hypotheses.location.loyerHc);
  const codePostal = enregistre.adresse?.codePostal;
  return {
    bien: {
      nom: enregistre.nom.slice(0, LONGUEUR_NOM_BIEN),
      adresse: enregistre.adresse?.libelle ?? '',
      type: bien.type,
      surface: bien.surface,
      meuble,
      projetId: enregistre.id,
      projet: { ...enregistre.projet },
      ...(codePostal === undefined ? {} : { codePostal }),
    },
    location: {
      type,
      debut: `${periodeSuivante(periodeDe(aujourdhui))}-01`,
      jourLoyer: JOUR_LOYER_DEFAUT,
      loyerHorsCharges,
      charges: enCentimes(hypotheses.location.chargesLocataire),
      depot: depotParDefaut(type, loyerHorsCharges),
    },
  };
}

/**
 * La création à envoyer depuis « Prêt à gérer » : l'adresse est toujours exigée ; le locataire
 * seulement si le bien est loué (« C'est parti »), pas pour « Pas encore loué ».
 */
export function creationPret(
  brouillon: Brouillon,
  saisie: SaisiePret,
  loue: boolean,
): ResultatPret {
  const erreurs: ChampPret[] = [];
  const adresse = saisie.adresse.trim();
  if (adresse === '') erreurs.push('adresse');
  const bien: NouveauBien = { ...brouillon.bien, adresse };
  if (!loue) {
    return erreurs.length > 0
      ? { ok: false, erreurs }
      : { ok: true, creation: { bien, locataire: null, location: null } };
  }
  const nom = decouperNom(saisie.locataire);
  if (nom === null) erreurs.push('locataire');
  const email = saisie.email.trim();
  if (email !== '' && !EmailSchema.safeParse(email).success) erreurs.push('email');
  if (nom === null || erreurs.length > 0) return { ok: false, erreurs };
  const locataire = email === '' ? nom : { ...nom, email };
  return { ok: true, creation: { bien, locataire, location: brouillon.location } };
}
