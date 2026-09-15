import {
  periodeDe,
  resumeDuMois,
  type BienGere,
  type EtatGestion,
  type LigneLoyer,
  type Locataire,
} from '@loupe/gestion';

import { etatDuBien } from './fiche';
import { groupesDeLocataires } from './locataires';

type Donnees = Pick<EtatGestion, 'biens' | 'locataires' | 'locations' | 'paiements'>;

/** Une chose à faire, déduite des données à l'affichage (ADR-G22) : jamais stockée. */
export type ActionAFaire =
  | { readonly type: 'retard'; readonly ligne: LigneLoyer }
  | { readonly type: 'vacant'; readonly bien: BienGere }
  /** Un bien acheté depuis une analyse avec emprunt, dont le prêt n'est pas encore enregistré. */
  | { readonly type: 'pret'; readonly bien: BienGere }
  | { readonly type: 'email'; readonly locataire: Locataire };

/** Les lignes montrées avant « Voir les N autres ». */
export const A_FAIRE_VISIBLES = 3;

/**
 * Dans l'ordre d'urgence : les loyers en retard du mois en cours (les plus anciennes échéances
 * d'abord), les biens sans location en cours ni à venir (par nom), les prêts à enregistrer (biens
 * déjà triés, calculés par la page Argent), puis les locataires en place ou qui arrivent sans
 * e-mail (par nom). Un ancien locataire sans e-mail n'en crée pas.
 */
export function actionsAFaire(
  donnees: Donnees,
  aujourdhui: string,
  pretsAEnregistrer: readonly BienGere[] = [],
): readonly ActionAFaire[] {
  const retards = resumeDuMois(donnees, periodeDe(aujourdhui), aujourdhui)
    .lignes.filter((ligne) => ligne.statut === 'en_retard')
    .map((ligne): ActionAFaire => ({ type: 'retard', ligne }));
  const vacants = donnees.biens
    .filter((bien) => etatDuBien(donnees, bien.id, aujourdhui).statut === 'vacant')
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }))
    .map((bien): ActionAFaire => ({ type: 'vacant', bien }));
  const emails = groupesDeLocataires(donnees, aujourdhui)
    .enCeMoment.filter((ligne) => ligne.locataire.email === undefined)
    .map((ligne): ActionAFaire => ({ type: 'email', locataire: ligne.locataire }));
  const prets = pretsAEnregistrer.map((bien): ActionAFaire => ({ type: 'pret', bien }));
  return [...retards, ...vacants, ...prets, ...emails];
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
  }
}
