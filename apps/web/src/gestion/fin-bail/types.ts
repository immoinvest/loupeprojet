import type {
  ChangementColocataire,
  ColocataireChange,
  CongeEnregistre,
  CongeRetire,
  CongeSaisie,
  DecompteComplet,
  EtatFinBail,
  ModeCharges,
  ModeChargesLocation,
  Regularisation,
  RegularisationValidee,
  Restitution,
  RestitutionEnregistree,
  RestitutionSaisie,
} from '@loupe/gestion';

/** Erreurs de la fin du bail, en codes stables ; les phrases sont dans `textes/gerer-fin-bail.ts`. */
export type CodeErreurFinBail =
  | 'non_connecte'
  | 'invalide'
  | 'introuvable'
  /** Une date dans le futur, ou hors du bail. */
  | 'date_invalide'
  /** Un congé reçu avant l'entrée du locataire. */
  | 'conge_invalide'
  | 'fin_avant_entree'
  | 'paiements_apres_sortie'
  /** Le dépôt se rend après la sortie. */
  | 'location_en_cours'
  | 'retenues_trop_elevees'
  /** Restitution ou régularisation déjà enregistrée (deux onglets, double clic). */
  | 'deja_enregistre'
  | 'depot_rendu'
  | 'regularisation_impossible'
  | 'colocataire_refuse'
  | 'bailleur_manquant'
  /** Dix colocataires au plus par location. */
  | 'limite'
  /** La migration 0011 n'est pas encore appliquée : « Bientôt disponible ». */
  | 'indisponible'
  | 'reseau'
  | 'inconnue';

export type ResultatFinBail<T = undefined> =
  | { readonly ok: true; readonly valeur: T }
  | { readonly ok: false; readonly code: CodeErreurFinBail };

/** L'API /api/gestion/fin-bail : une version réseau et une version mémoire (tests, aperçu). */
export interface ClientFinBail {
  etat(): Promise<ResultatFinBail<EtatFinBail>>;
  /** Enregistre (ou déplace) le congé et la sortie qu'il entraîne. */
  enregistrerConge(
    locationId: string,
    saisie: CongeSaisie,
  ): Promise<ResultatFinBail<CongeEnregistre>>;
  /** Retire le congé et la sortie. */
  retirerConge(locationId: string): Promise<ResultatFinBail<CongeRetire>>;
  enregistrerModeCharges(
    locationId: string,
    mode: ModeCharges,
  ): Promise<ResultatFinBail<ModeChargesLocation>>;
  /** Enregistre la restitution du dépôt et son décompte figé. */
  restituer(
    locationId: string,
    saisie: RestitutionSaisie,
  ): Promise<ResultatFinBail<RestitutionEnregistree>>;
  rendreDepot(locationId: string, rendueLe: string): Promise<ResultatFinBail<Restitution>>;
  annulerRestitution(locationId: string): Promise<ResultatFinBail>;
  /** Valide la régularisation d'une année : échéance et décompte figé. */
  regulariser(locationId: string, annee: number): Promise<ResultatFinBail<RegularisationValidee>>;
  reglerRegularisation(id: string, regleeLe: string): Promise<ResultatFinBail<Regularisation>>;
  changerColocataire(
    locationId: string,
    changement: ChangementColocataire,
  ): Promise<ResultatFinBail<ColocataireChange>>;
  decompte(id: string): Promise<ResultatFinBail<DecompteComplet>>;
}
