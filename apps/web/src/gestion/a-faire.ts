import {
  periodeDe,
  resumeDuMois,
  type BienGere,
  type EtatGestion,
  type LigneLoyer,
  type Locataire,
} from '@loupe/gestion';

import { SANS_ACTIONS_ENVOIS, type ActionsEnvois } from './envois/logique';
import { etatDuBien } from './fiche';
import { groupesDeLocataires } from './locataires';

type Donnees = Pick<EtatGestion, 'biens' | 'locataires' | 'locations' | 'paiements'>;

/** Une chose à faire, déduite des données à l'affichage (ADR-G22) : jamais stockée. */
export type ActionAFaire =
  | { readonly type: 'retard'; readonly ligne: LigneLoyer }
  /** La dernière quittance envoyée par e-mail a échoué (quittances-auto). */
  | { readonly type: 'email_a_verifier'; readonly locataire: Locataire }
  | { readonly type: 'vacant'; readonly bien: BienGere }
  | { readonly type: 'email'; readonly locataire: Locataire }
  /** Invité à recevoir ses quittances par e-mail, sans réponse ; montré tant que sa fiche n'est pas ouverte. */
  | { readonly type: 'accord'; readonly locataire: Locataire };

/** Les lignes montrées avant « Voir les N autres ». */
export const A_FAIRE_VISIBLES = 3;

/**
 * Dans l'ordre d'urgence : les loyers en retard du mois en cours (les plus anciennes échéances
 * d'abord), les biens sans location en cours ni à venir (par nom), puis les locataires en place
 * ou qui arrivent sans e-mail (par nom). Un ancien locataire sans e-mail n'en crée pas.
 */
export function actionsAFaire(
  donnees: Donnees,
  aujourdhui: string,
  envois: ActionsEnvois = SANS_ACTIONS_ENVOIS,
): readonly ActionAFaire[] {
  const retards = resumeDuMois(donnees, periodeDe(aujourdhui), aujourdhui)
    .lignes.filter((ligne) => ligne.statut === 'en_retard')
    .map((ligne): ActionAFaire => ({ type: 'retard', ligne }));
  const locatairesDe = (ids: readonly string[]): Locataire[] =>
    donnees.locataires.filter((l) => ids.includes(l.id));
  const aVerifier = locatairesDe(envois.aVerifier).map((locataire): ActionAFaire => ({
    type: 'email_a_verifier',
    locataire,
  }));
  const accords = locatairesDe(envois.enAttente).map((locataire): ActionAFaire => ({
    type: 'accord',
    locataire,
  }));
  const vacants = donnees.biens
    .filter((bien) => etatDuBien(donnees, bien.id, aujourdhui).statut === 'vacant')
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }))
    .map((bien): ActionAFaire => ({ type: 'vacant', bien }));
  const emails = groupesDeLocataires(donnees, aujourdhui)
    .enCeMoment.filter((ligne) => ligne.locataire.email === undefined)
    .map((ligne): ActionAFaire => ({ type: 'email', locataire: ligne.locataire }));
  return [...retards, ...aVerifier, ...vacants, ...emails, ...accords];
}

/** Une clé stable par action (un même locataire peut être en retard et sans e-mail). */
export function cleAction(action: ActionAFaire): string {
  switch (action.type) {
    case 'retard':
      return `retard-${action.ligne.location.id}`;
    case 'vacant':
      return `vacant-${action.bien.id}`;
    case 'email':
      return `email-${action.locataire.id}`;
    case 'email_a_verifier':
      return `email-a-verifier-${action.locataire.id}`;
    case 'accord':
      return `accord-${action.locataire.id}`;
  }
}
