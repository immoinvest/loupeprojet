import type {
  EtatBail,
  LegalBien,
  LegalBienSaisie,
  LettreRevisionComplete,
  RevisionAppliquee,
  RevisionLocation,
  RevisionSaisie,
} from '@loupe/gestion';

/** Erreurs de la vie du bail, en codes stables ; les phrases sont dans `textes/gerer-bail.ts`. */
export type CodeErreurBail =
  | 'non_connecte'
  | 'invalide'
  | 'introuvable'
  /** La révision n'est plus proposée (gel, indice attendu, déjà faite, anniversaire changé). */
  | 'revision_impossible'
  | 'bailleur_manquant'
  | 'periode_payee'
  | 'hors_location'
  | 'limite'
  /** La migration 0008 n'est pas encore appliquée, ou Gérer est en panne : « Bientôt disponible ». */
  | 'indisponible'
  | 'reseau'
  | 'inconnue';

export type ResultatBail<T> =
  { readonly ok: true; readonly valeur: T } | { readonly ok: false; readonly code: CodeErreurBail };

/** L'API /api/gestion/bail : une version réseau et une version mémoire (tests, aperçu). */
export interface ClientBail {
  etat(): Promise<ResultatBail<EtatBail>>;
  enregistrerBien(bienId: string, saisie: LegalBienSaisie): Promise<ResultatBail<LegalBien>>;
  enregistrerRevision(
    locationId: string,
    saisie: RevisionSaisie,
  ): Promise<ResultatBail<RevisionLocation>>;
  appliquerRevision(
    locationId: string,
    anniversaire: string,
  ): Promise<ResultatBail<RevisionAppliquee>>;
  lettre(id: string): Promise<ResultatBail<LettreRevisionComplete>>;
}
