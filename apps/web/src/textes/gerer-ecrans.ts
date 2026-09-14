import type { StatutLoyer } from '@loupe/gestion';

import type { TonPastille } from '@/composants/ui';

/** Textes des écrans de Gérer (tutoiement, comme l'analyse). */
export const TEXTES_GERER = {
  titre: 'Gérer',
  chargement: 'Chargement de tes biens…',
  reessayer: 'Réessayer',
  sansCompteTitre: 'Tes loyers suivis, tes quittances envoyées toutes seules.',
  sansCompteTexte:
    'Pour travailler même quand ton ordinateur est éteint, Deklic garde tes biens sur ses serveurs, en Europe. Il faut un compte : gratuit, sans mot de passe.',
  seConnecter: 'Se connecter',
  continuerAnalyser: 'Continuer à analyser',
  portesTitre: 'Mettons tes biens en pilote automatique.',
  portesSous: 'Deux clics, promis.',
  porteAchatTitre: 'J’ai acheté un bien analysé',
  porteAchatTexte: 'On reprend tout de ton analyse : loyer, charges, surface.',
  porteAchatBouton: 'Gérer ce bien',
  porteAchatVide: 'Aucun projet à reprendre pour l’instant.',
  porteBanqueTitre: 'Connecter ma banque',
  porteBanqueTexte: 'Déjà propriétaire ? On retrouvera tes loyers dans tes comptes.',
  bientot: 'Bientôt',
  porteMainTitre: 'Ajouter à la main',
  porteMainTexte: 'Une adresse, un loyer, un locataire.',
  ajouterBien: 'Ajouter un bien',
  listeTitre: 'Les loyers du mois',
  recu: 'Reçu',
  annuler: 'Annuler',
  tonLocataire: 'ton locataire',
} as const;

export const STATUTS_LOYER: Readonly<Record<StatutLoyer, string>> = {
  a_venir: 'À venir',
  attendu: 'Attendu',
  en_retard: 'En retard',
  recu: 'Reçu',
};

export const TONS_LOYER: Readonly<Record<StatutLoyer, TonPastille>> = {
  a_venir: 'neutre',
  attendu: 'accent',
  en_retard: 'probleme',
  recu: 'bon',
};

/** « 3 loyers sur 4 reçus », « Tous les loyers sont reçus. », « Aucun loyer attendu ce mois-ci. » */
export function phraseDuMois(recus: number, total: number): string {
  if (total === 0) return 'Aucun loyer attendu ce mois-ci.';
  if (recus === total) return total === 1 ? 'Le loyer est reçu.' : 'Tous les loyers sont reçus.';
  // L'accord suit le nombre reçu : « 1 loyer sur 4 reçu », « 3 loyers sur 4 reçus ».
  const loyers = recus > 1 ? 'loyers' : 'loyer';
  return `${String(recus)} ${loyers} sur ${String(total)} reçu${recus > 1 ? 's' : ''}`;
}

/** « Septembre 2026 » à partir de « septembre 2026 ». */
export function avecMajuscule(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** Élision devant une voyelle ou un h muet : « de Julie », « d’Antoine », « d’Hugo ». */
export function de(nom: string): string {
  return /^[aeiouyhàâäéèêëîïôöûü]/i.test(nom) ? `d’${nom}` : `de ${nom}`;
}

export function loyerRecu(prenom: string): string {
  return `Loyer ${de(prenom)} reçu.`;
}

export function marquerRecu(prenom: string): string {
  return `Marquer reçu le loyer ${de(prenom)}`;
}

/** « Sans locataire : Parking Prado » ; plusieurs biens séparés par des virgules. */
export function biensVacants(noms: readonly string[]): string {
  return `Sans locataire : ${noms.join(', ')}`;
}
