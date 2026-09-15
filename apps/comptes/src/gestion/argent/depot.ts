import type {
  Depense,
  EtatArgent,
  NouvelleDepense,
  PretBien,
  PretEnregistre,
} from '@loupe/gestion';

/** Les erreurs métier des dépenses et du prêt ; toute autre erreur est interne. */
export type CodeErreurArgent =
  /** Dépense ou bien d'un autre compte, ou inexistant. */
  | 'INTROUVABLE'
  /** Le compte a atteint le nombre maximal de dépenses. */
  | 'LIMITE_ATTEINTE';

export class ErreurArgent extends Error {
  readonly code: CodeErreurArgent;

  constructor(code: CodeErreurArgent) {
    super(code);
    this.name = 'ErreurArgent';
    this.code = code;
  }
}

/**
 * Dépenses et prêts d'un compte (tables de la migration 0007, ADR-G24). Chaque méthode ne lit et
 * n'écrit que les lignes de `userId` : une ressource d'un autre compte est « introuvable ».
 */
export interface DepotArgent {
  /** Toutes les dépenses et tous les prêts du compte. */
  etat(userId: string): Promise<EtatArgent>;
  depenses(userId: string): Promise<Depense[]>;
  /** Lève INTROUVABLE (bien d'un autre compte) ou LIMITE_ATTEINTE. */
  ajouterDepense(userId: string, depense: NouvelleDepense): Promise<Depense>;
  /** Remplace tous les champs ; lève INTROUVABLE (dépense ou bien hors du compte). */
  modifierDepense(userId: string, id: string, depense: NouvelleDepense): Promise<Depense>;
  /** Lève INTROUVABLE. */
  supprimerDepense(userId: string, id: string): Promise<void>;
  /** Le prêt du bien, ou `null` s'il n'en a pas ; lève INTROUVABLE si le bien n'est pas du compte. */
  pret(userId: string, bienId: string): Promise<PretEnregistre | null>;
  /** Crée ou remplace le prêt du bien ; lève INTROUVABLE. */
  enregistrerPret(userId: string, bienId: string, pret: PretBien): Promise<PretEnregistre>;
  /** Lève INTROUVABLE si le bien n'a pas de prêt dans ce compte. */
  supprimerPret(userId: string, bienId: string): Promise<void>;
  /** Pour l'export de Gérer : dépenses et prêts, ou `null` tant que la migration 0007 manque. */
  exporter(userId: string): Promise<EtatArgent | null>;
}

const TABLE_ABSENTE = 'no such table: gestion_';

/** La base n'a pas encore reçu la migration 0007 (ou une migration de gestion antérieure). */
export function estTableArgentAbsente(erreur: unknown): boolean {
  return erreur instanceof Error && erreur.message.includes(TABLE_ABSENTE);
}
