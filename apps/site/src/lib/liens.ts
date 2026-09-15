import { origineProduction } from '@loupe/capture/origines';

/**
 * Paramètre lu par l'écran Nouveau projet de l'application (`share_target` du manifeste du web,
 * `annonces/partage-recu.ts`) : un texte partagé dont le premier lien d'annonce est retenu. Le texte
 * plutôt que le lien seul, parce qu'un partage copié depuis un téléphone entoure souvent le lien de mots.
 */
export const PARAMETRE_TEXTE = 'texte';

/** Les pages de l'application vers lesquelles le site envoie. */
export interface LiensApplication {
  readonly origine: string;
  readonly connexion: string;
  readonly nouveauProjet: string;
  readonly gerer: string;
  readonly extension: string;
  readonly simulateurPret: string;
}

/**
 * Liens vers l'application de production. `valeurEnv` = variable de build `DEKLIC_ORIGINE` (même règle
 * que le web) : absente ou invalide, l'adresse historique ; jamais l'adresse d'un aperçu.
 */
export function liensApplication(valeurEnv: string | undefined): LiensApplication {
  const origine = origineProduction(valeurEnv);
  const lien = (chemin: string): string => new URL(chemin, origine).href;
  return {
    origine,
    connexion: lien('/connexion'),
    nouveauProjet: lien('/projets/nouveau'),
    gerer: lien('/gerer'),
    extension: lien('/extension'),
    simulateurPret: lien('/simulateur-pret'),
  };
}

/** L'adresse qu'ouvre le formulaire « Analyser mon annonce » pour un texte donné (lien compris). */
export function lienAnalyse(liens: LiensApplication, texte: string): string {
  const url = new URL(liens.nouveauProjet);
  url.searchParams.set(PARAMETRE_TEXTE, texte);
  return url.href;
}
