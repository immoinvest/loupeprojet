import { MAX_CHANGEMENTS, type Changement, type ReponseSynchro } from './contrat';
import { estExempleIntact, type ProjetEnregistre } from './enregistre';
import { JOURNAL_VIDE, type JournalSynchro } from './journal';

/** Les projets de l'appareil et son journal, transformés ensemble. */
export interface EtatLocal {
  readonly projets: readonly ProjetEnregistre[];
  readonly journal: JournalSynchro;
}

/** Ce qui est parti dans une requête : la date de chaque projet et de chaque suppression envoyés. */
export interface Envoi {
  readonly enregistres: Readonly<Record<string, string>>;
  readonly supprimes: Readonly<Record<string, string>>;
}

export interface Preparation {
  readonly changements: readonly Changement[];
  readonly envoi: Envoi;
}

const RIEN: Preparation = { changements: [], envoi: { enregistres: {}, supprimes: {} } };

/**
 * L'appareil se lie au compte `compte`. Même compte : rien ne change. Autre compte : les projets
 * synchronisés avec le précédent quittent l'appareil (ils sont sur leur compte) ; tous les autres
 * sont à envoyer, après une première lecture du compte.
 */
export function changerDeCompte(etat: EtatLocal, compte: string): EtatLocal {
  const { projets, journal } = etat;
  if (journal.compte === compte) return etat;
  const precedents = new Set(journal.compte === null ? [] : journal.synchronises);
  const restants = projets.filter((p) => !precedents.has(p.id));
  return {
    projets: restants,
    journal: {
      ...JOURNAL_VIDE,
      compte,
      premiere: true,
      aEnvoyer: restants.map((p) => p.id),
    },
  };
}

/**
 * Déconnexion : les projets synchronisés quittent l'appareil ; ceux qui ne sont pas encore sur le
 * compte (modifiés ou créés depuis le dernier envoi) restent, sans compte.
 */
export function oublierCompte(etat: EtatLocal): EtatLocal {
  const enAttente = new Set(etat.journal.aEnvoyer);
  const synchronises = new Set(etat.journal.synchronises);
  return {
    projets: etat.projets.filter((p) => enAttente.has(p.id) || !synchronises.has(p.id)),
    journal: JOURNAL_VIDE,
  };
}

/** Compte supprimé : ses projets restent sur l'appareil, sans compte. */
export function detacherCompte(etat: EtatLocal): EtatLocal {
  return { projets: etat.projets, journal: JOURNAL_VIDE };
}

/**
 * Le prochain lot : les suppressions d'abord, puis les projets à envoyer, `MAX_CHANGEMENTS` au plus.
 * Rien avant la première lecture du compte ; `exclus` écarte les projets déjà refusés dans ce cycle.
 */
export function preparerEnvoi(
  etat: EtatLocal,
  exclus: ReadonlySet<string> = new Set(),
): Preparation {
  const { projets, journal } = etat;
  if (journal.compte === null || journal.premiere) return RIEN;
  const changements: Changement[] = [];
  const enregistres: Record<string, string> = {};
  const supprimes: Record<string, string> = {};
  for (const [id, le] of Object.entries(journal.aSupprimer)) {
    if (changements.length === MAX_CHANGEMENTS) break;
    changements.push({ type: 'supprimer', id, le });
    supprimes[id] = le;
  }
  const parId = new Map(projets.map((p) => [p.id, p]));
  for (const id of journal.aEnvoyer) {
    if (changements.length === MAX_CHANGEMENTS) break;
    const projet = parId.get(id);
    if (projet === undefined || exclus.has(id)) continue;
    changements.push({ type: 'enregistrer', projet });
    enregistres[id] = projet.modifieLe;
  }
  return { changements, envoi: { enregistres, supprimes } };
}

/** Du plus récemment créé au plus ancien, comme la liste de Mes projets. */
function parCreationDecroissante(a: ProjetEnregistre, b: ProjetEnregistre): number {
  if (a.creeLe === b.creeLe) return 0;
  return a.creeLe < b.creeLe ? 1 : -1;
}

/**
 * Applique la réponse du compte à l'état **actuel** de l'appareil (qui a pu changer pendant l'envoi) :
 * un envoi confirmé sort du journal sauf si le projet a encore bougé ; les projets reçus remplacent
 * les copies locales qui n'attendent rien ; un projet synchronisé absent du compte quitte l'appareil.
 */
export function appliquerReponse(
  etat: EtatLocal,
  envoi: Envoi,
  reponse: ReponseSynchro,
): EtatLocal {
  const { journal } = etat;
  const refuses = new Set(reponse.refuses);
  const ids = new Set(reponse.ids);

  let projets = etat.projets;
  // Première lecture d'un compte qui a déjà des projets : l'exemple de cet appareil ferait doublon.
  if (journal.premiere && ids.size > 0) {
    projets = projets.filter((p) => ids.has(p.id) || !estExempleIntact(p));
  }
  const locaux = new Map(projets.map((p) => [p.id, p]));

  const aEnvoyer = journal.aEnvoyer.filter((id) => {
    const local = locaux.get(id);
    if (local === undefined) return false;
    const envoye = envoi.enregistres[id];
    return envoye === undefined || refuses.has(id) || local.modifieLe !== envoye;
  });
  const aSupprimer = Object.fromEntries(
    Object.entries(journal.aSupprimer).filter(([id, le]) => envoi.supprimes[id] !== le),
  );
  const enAttente = new Set(aEnvoyer);

  const fusion = new Map(locaux);
  for (const recu of reponse.projets) {
    if (enAttente.has(recu.id) || Object.hasOwn(aSupprimer, recu.id)) continue;
    fusion.set(recu.id, recu);
  }
  for (const id of locaux.keys()) {
    if (!ids.has(id) && !enAttente.has(id)) fusion.delete(id);
  }

  return {
    projets: [...fusion.values()].sort(parCreationDecroissante),
    journal: {
      ...journal,
      curseur: reponse.curseur,
      premiere: false,
      synchronises: [...reponse.ids],
      aEnvoyer,
      aSupprimer,
    },
  };
}
