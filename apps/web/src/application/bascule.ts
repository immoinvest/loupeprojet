import { ORIGINE_HISTORIQUE } from '@loupe/capture/origines';

/**
 * Bascule de l'ancienne adresse vers la nouvelle (fiche 23), décidée au chargement de la page.
 * Rien ne se passe sans le drapeau de build `DEKLIC_TRANSFERT=1`, ni ailleurs que sur l'adresse
 * historique exacte : aperçus, localhost et la nouvelle adresse restent où ils sont.
 */

export type DecisionBascule =
  | { readonly type: 'rester' }
  | { readonly type: 'transferer'; readonly cible: string }
  | { readonly type: 'rediriger'; readonly url: string };

export interface SituationBascule {
  readonly actif: boolean;
  readonly origineCourante: string;
  readonly origineCible: string;
  /** Chemin, requête et fragment de la page ouverte, repris tels quels par la redirection. */
  readonly chemin: string;
  /** Des projets de l'appareil pas encore transférés. */
  readonly aTransferer: boolean;
}

export function decisionBascule(situation: SituationBascule): DecisionBascule {
  const { actif, origineCourante, origineCible, chemin, aTransferer } = situation;
  if (!actif || origineCourante !== ORIGINE_HISTORIQUE || origineCible === origineCourante) {
    return { type: 'rester' };
  }
  if (aTransferer) return { type: 'transferer', cible: origineCible };
  return { type: 'rediriger', url: `${origineCible}${chemin}` };
}
