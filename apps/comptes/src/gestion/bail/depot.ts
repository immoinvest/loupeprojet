import type {
  EtatBail,
  LegalBien,
  LegalBienSaisie,
  LettreRevisionComplete,
  RevisionAppliquee,
  RevisionLocation,
  RevisionSaisie,
} from '@loupe/gestion';

/** Les erreurs métier du bail, traduites en réponses par son routeur. */
export type CodeErreurBail =
  | 'INTROUVABLE'
  /** La révision n'est pas (ou plus) proposée pour cet anniversaire : gel, indice attendu, déjà faite… */
  | 'REVISION_IMPOSSIBLE'
  /** Pas de nom ni d'adresse de bailleur : la lettre ne peut pas être écrite. */
  | 'BAILLEUR_MANQUANT'
  /** Mois d'effet hors de la location ou à plus d'un an. */
  | 'HORS_LOCATION'
  /** Trop de changements de montants sur la location (borne de G1c). */
  | 'LIMITE_ATTEINTE'
  /** Un paiement est arrivé pour le mois d'effet ou après : rien n'est écrit (ADR-G26). */
  | 'PERIODE_PAYEE';

export class ErreurBail extends Error {
  readonly code: CodeErreurBail;

  constructor(code: CodeErreurBail) {
    super(code);
    this.name = 'ErreurBail';
    this.code = code;
  }
}

/** La révision appliquée ; `nouvelle` est faux si la lettre existait déjà (même anniversaire). */
export interface ApplicationRevision {
  readonly resultat: RevisionAppliquee;
  readonly nouvelle: boolean;
}

/**
 * Caractéristiques légales des biens, réglages de révision et lettres d'un compte (ADR-G24). Chaque
 * méthode ne lit et n'écrit que les lignes de `userId` : un objet d'un autre compte est introuvable.
 */
export interface DepotBail {
  etat(userId: string): Promise<EtatBail>;
  /** Lève INTROUVABLE. */
  enregistrerBien(userId: string, bienId: string, saisie: LegalBienSaisie): Promise<LegalBien>;
  /** Lève INTROUVABLE. */
  enregistrerRevision(
    userId: string,
    locationId: string,
    saisie: RevisionSaisie,
  ): Promise<RevisionLocation>;
  /** Lève INTROUVABLE, REVISION_IMPOSSIBLE, BAILLEUR_MANQUANT, HORS_LOCATION, LIMITE_ATTEINTE ou PERIODE_PAYEE. */
  appliquerRevision(
    userId: string,
    locationId: string,
    anniversaire: string,
  ): Promise<ApplicationRevision>;
  /** Lève INTROUVABLE. */
  lettre(userId: string, id: string): Promise<LettreRevisionComplete>;
}

/** Les tables de la migration 0008. */
export const TABLES_BAIL = [
  'gestion_bien_legal',
  'gestion_location_revision',
  'gestion_bail_lettre',
] as const;

/** La migration 0008 n'est pas encore appliquée : une de nos tables manque. */
export function estTableBailAbsente(erreur: unknown): boolean {
  const message = erreur instanceof Error ? erreur.message : '';
  return TABLES_BAIL.some((table) => new RegExp(`no such table: ${table}\\b`).test(message));
}
