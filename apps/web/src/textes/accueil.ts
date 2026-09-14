import type { ActionProjet } from '@/accueil';

/** Nom accessible du logo : il mène à l'accueil. */
export const TEXTES_LOGO = 'Deklic : accueil';

/** Textes de l'écran Accueil (tutoiement, comme l'analyse et Gérer). */
export const TEXTES_ACCUEIL = {
  bienvenue: 'Bienvenue sur Deklic',
  analyser: 'Analyser',
  gerer: 'Gérer',
  analyserVideTitre: 'Ton premier investissement commence par une annonce.',
  analyserVideTexte: 'Colle son lien : cash-flow, rendement et impôts en deux minutes.',
  analyserAnnonce: 'Analyser une annonce',
  voirExemple: 'Voir l’exemple',
  meilleurCashflow: 'Meilleur cash-flow',
  prochaineEtape: 'Prochaine étape',
  parcours: 'Où en sont tes projets',
  nouveauProjet: 'Nouveau projet',
  tousMesProjets: 'Tous mes projets',
  gererSansCompteTitre: 'Tes loyers suivis, tes quittances prêtes.',
  gererSansCompteTexte: 'Il faut un compte : gratuit, sans mot de passe.',
  seConnecter: 'Se connecter',
  gererVideTitre: 'Ton bien est acheté ? Mets-le en pilote automatique.',
  gererVideTexte: 'Loyers suivis, retards repérés, quittances : deux clics pour commencer.',
  ajouterPremierBien: 'Ajouter mon premier bien',
  voirLoyers: 'Voir les loyers du mois',
  ajouterBien: 'Ajouter un bien',
  aJour: 'Aucun retard',
} as const;

/** « Bonjour Camille » avec un nom, « Bienvenue sur Deklic » sinon. */
export function titreAccueil(nom: string | null): string {
  const prenom = nom?.trim().split(/\s+/)[0] ?? '';
  return prenom === '' ? TEXTES_ACCUEIL.bienvenue : `Bonjour ${prenom}`;
}

/** « projet à l'étude », « projets à l'étude » (le nombre est affiché à part, en grand). */
export function projetsAEtudier(nombre: number): string {
  return nombre > 1 ? 'projets à l’étude' : 'projet à l’étude';
}

/** « 1 bien », « 3 biens ». */
export function nombreDeBiens(nombre: number): string {
  return `${String(nombre)} ${nombre > 1 ? 'biens' : 'bien'}`;
}

export const BOUTONS_ETAPE: Readonly<Record<ActionProjet, string>> = {
  gerer: 'Gérer ce bien',
  financement: 'Vérifier le financement',
  visite: 'Préparer la visite',
  rapport: 'Voir le rapport',
};

/** La prochaine étape en une phrase, avec le nom du projet. */
export function phraseEtape(action: ActionProjet, nom: string): string {
  switch (action) {
    case 'gerer':
      return `Tu as acheté ${nom} : fais-le travailler.`;
    case 'financement':
      return `Offre faite sur ${nom} : sécurise ton financement.`;
    case 'visite':
      return `Visite prévue pour ${nom} : prépare tes questions.`;
    case 'rapport':
      return `${nom} attend ton verdict.`;
  }
}
