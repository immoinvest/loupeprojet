import type { FournisseurSocial } from '@/compte/types';

import { NOMS_FOURNISSEURS } from './compte';

/** Même durée que le serveur (apps/comptes/src/courriel.ts, DUREE_CODE_MINUTES). */
export const DUREE_CODE_MINUTES = 10;

export const TEXTES_CONNEXION = {
  titre: 'Se connecter',
  sousTitre:
    'Retrouvez vos projets sur tous vos appareils. Pas encore de compte ? Il se crée à la première connexion.',
  ou: 'ou',
  libelleEmail: 'Adresse e-mail',
  recevoirCode: 'Recevoir mon code',
  titreCode: 'Saisissez votre code',
  libelleCode: 'Code à 6 chiffres',
  meConnecter: 'Me connecter',
  renvoyer: 'Renvoyer un code',
  changerAdresse: "Changer d'adresse",
  codeRenvoye: 'Un nouveau code est parti.',
  chargement: 'Chargement des méthodes de connexion…',
  sansCompte: 'Continuer sans compte',
  mentions: 'Gratuit, sans mot de passe. Sans compte, vos projets restent sur cet appareil.',
} as const;

export function libelleContinuerAvec(fournisseur: FournisseurSocial): string {
  return `Continuer avec ${NOMS_FOURNISSEURS[fournisseur]}`;
}

export function codeEnvoyeA(email: string): string {
  return `Un code à 6 chiffres vient de partir vers ${email}. Il est valable ${String(DUREE_CODE_MINUTES)} minutes.`;
}

/** Retour d'un fournisseur en échec (`/connexion?fournisseur=google&error=…`), sinon rien. */
export function echecFournisseur(parametre: string | null): string | null {
  if (parametre !== 'google' && parametre !== 'apple') return null;
  return `La connexion avec ${NOMS_FOURNISSEURS[parametre]} n'a pas abouti. Réessayez, ou recevez un code par e-mail.`;
}
