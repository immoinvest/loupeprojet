import type { CodeErreurCompte, FournisseurSocial, Utilisateur } from '@/compte/types';

/** Une phrase par code d'erreur du compte : courte, et qui dit quoi faire. */
export const ERREURS_COMPTE: Readonly<Record<CodeErreurCompte, string>> = {
  email_invalide: 'Cette adresse e-mail ne semble pas valide.',
  code_invalide: "Ce code n'est pas le bon. Vérifiez le dernier e-mail reçu.",
  code_expire: 'Ce code a expiré. Demandez-en un nouveau.',
  trop_essais: 'Trop d’essais avec ce code. Demandez-en un nouveau.',
  trop_de_demandes: 'Trop de demandes en peu de temps. Réessayez dans une minute.',
  session_ancienne: 'Par sécurité, reconnectez-vous avant de supprimer votre compte.',
  indisponible:
    "La connexion n'est pas disponible pour le moment. Vos projets restent accessibles.",
  reseau: 'Impossible de joindre Deklic. Vérifiez votre connexion internet.',
  inconnue: "Quelque chose n'a pas marché. Réessayez.",
};

export const NOMS_FOURNISSEURS: Readonly<Record<FournisseurSocial, string>> = {
  google: 'Google',
  apple: 'Apple',
};

type Identite = Pick<Utilisateur, 'nom' | 'email'>;

/** « Camille Durand » → « CD » ; sans nom, la première lettre de l'adresse. */
export function initiales(u: Identite): string {
  const mots = u.nom
    .trim()
    .split(/\s+/)
    .filter((m) => m !== '');
  if (mots.length === 0) return (u.email.at(0) ?? '?').toUpperCase();
  return mots
    .slice(0, 2)
    .map((m) => m.charAt(0).toUpperCase())
    .join('');
}

/** Le nom s'il existe, sinon l'adresse e-mail. */
export function nomAffiche(u: Identite): string {
  const nom = u.nom.trim();
  return nom === '' ? u.email : nom;
}
