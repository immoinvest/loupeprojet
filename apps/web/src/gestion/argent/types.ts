import type {
  Depense,
  EtatArgent,
  NouvelleDepense,
  PretBien,
  PretEnregistre,
} from '@loupe/gestion';

/** Erreurs des dépenses et du prêt, en codes stables ; les phrases sont dans `textes/gerer-argent.ts`. */
export type CodeErreurArgent =
  | 'non_connecte'
  | 'invalide'
  | 'introuvable'
  /** 2 000 dépenses dans le compte. */
  | 'limite'
  /** La migration 0007 n'est pas encore appliquée : « Bientôt disponible ». */
  | 'indisponible'
  | 'reseau'
  | 'inconnue';

export type ResultatArgent<T = undefined> =
  | { readonly ok: true; readonly valeur: T }
  | { readonly ok: false; readonly code: CodeErreurArgent };

/** Les dépenses et les prêts des biens gérés ; une version réseau (l'API) et une version mémoire (tests). */
export interface ClientArgent {
  etat(): Promise<ResultatArgent<EtatArgent>>;
  ajouterDepense(depense: NouvelleDepense): Promise<ResultatArgent<Depense>>;
  /** Remplace tous les champs de la dépense. */
  modifierDepense(id: string, depense: NouvelleDepense): Promise<ResultatArgent<Depense>>;
  supprimerDepense(id: string): Promise<ResultatArgent>;
  /** Crée ou remplace le prêt du bien. */
  enregistrerPret(bienId: string, pret: PretBien): Promise<ResultatArgent<PretEnregistre>>;
  supprimerPret(bienId: string): Promise<ResultatArgent>;
}
