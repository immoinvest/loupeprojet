import {
  periodeDe,
  resumeDuMois,
  type BienGere,
  type EtatGestion,
  type LigneLoyer,
  type Locataire,
} from '@loupe/gestion';

import type { ActionBail } from './bail/vue';
import { SANS_ACTIONS_ENVOIS, type ActionsEnvois } from './envois/logique';
import { cleActionFinBail, type ActionFinBail } from './fin-bail/vue';
import { etatDuBien } from './fiche';
import { groupesDeLocataires } from './locataires';

type Donnees = Pick<EtatGestion, 'biens' | 'locataires' | 'locations' | 'paiements'>;

/** Une chose à faire, déduite des données à l'affichage (ADR-G22) : jamais stockée. */
export type ActionAFaire =
  | { readonly type: 'retard'; readonly ligne: LigneLoyer }
  /** La dernière quittance envoyée par e-mail a échoué (quittances-auto). */
  | { readonly type: 'email_a_verifier'; readonly locataire: Locataire }
  | { readonly type: 'vacant'; readonly bien: BienGere }
  /** Un bien acheté depuis une analyse avec emprunt, dont le prêt n'est pas encore enregistré. */
  | { readonly type: 'pret'; readonly bien: BienGere }
  | { readonly type: 'email'; readonly locataire: Locataire }
  /** Invité à recevoir ses quittances par e-mail, sans réponse ; montré tant que sa fiche n'est pas ouverte. */
  | { readonly type: 'accord'; readonly locataire: Locataire }
  /** Vie du bail (B1) : alertes de conformité urgentes, puis révisions à valider. */
  | ActionBail
  /** Fin du bail (B2) : dépôts à rendre, charges à régulariser puis à régler. */
  | ActionFinBail;

/** Les lignes montrées avant « Voir les N autres ». */
export const A_FAIRE_VISIBLES = 3;

/**
 * Dans l'ordre d'urgence : les loyers en retard du mois en cours (les plus anciennes échéances
 * d'abord), les biens sans location en cours ni à venir (par nom), les prêts à enregistrer (biens
 * déjà triés, calculés par la page Argent), puis les locataires en place ou qui arrivent sans
 * e-mail (par nom). Un ancien locataire sans e-mail n'en crée pas. Enfin, les lignes de la vie du
 * bail (`actionsBail`), calculées à part quand ses données sont chargées.
 */
export function actionsAFaire(
  donnees: Donnees,
  aujourdhui: string,
  pretsAEnregistrer: readonly BienGere[] = [],
  bail: readonly ActionBail[] = [],
  envois: ActionsEnvois = SANS_ACTIONS_ENVOIS,
  finBail: readonly ActionFinBail[] = [],
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
  const prets = pretsAEnregistrer.map((bien): ActionAFaire => ({ type: 'pret', bien }));
  return [
    ...retards,
    ...aVerifier,
    ...vacants,
    ...prets,
    ...emails,
    ...accords,
    ...bail,
    ...finBail,
  ];
}

/** Une clé stable par action (un même locataire peut être en retard et sans e-mail). */
export function cleAction(action: ActionAFaire): string {
  switch (action.type) {
    case 'retard':
      return `retard-${action.ligne.location.id}`;
    case 'vacant':
      return `vacant-${action.bien.id}`;
    case 'pret':
      return `pret-${action.bien.id}`;
    case 'email':
      return `email-${action.locataire.id}`;
    case 'email_a_verifier':
      return `email-a-verifier-${action.locataire.id}`;
    case 'accord':
      return `accord-${action.locataire.id}`;
    case 'alerte': {
      const { alerte } = action;
      const location = alerte.code === 'fin_bail_court' ? `-${alerte.locationId}` : '';
      return `alerte-${action.bien.id}-${alerte.code}${location}`;
    }
    case 'revision':
      return `revision-${action.location.id}`;
    case 'depot':
    case 'regularisation':
    case 'charges_a_regler':
      return cleActionFinBail(action);
  }
}
