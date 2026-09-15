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

/** Les erreurs métier de la fin du bail, traduites en réponses par son routeur. */
export type CodeErreurFinBail =
  | 'INTROUVABLE'
  /** Une sortie avant l'entrée. */
  | 'FIN_AVANT_ENTREE'
  /** Des loyers sont déjà reçus pour des mois après la sortie demandée. */
  | 'PAIEMENTS_APRES_SORTIE'
  /** Une date dans le futur (congé reçu, dépôt rendu, régularisation réglée) ou hors du bail. */
  | 'DATE_INVALIDE'
  /** Un congé reçu avant l'entrée du locataire. */
  | 'CONGE_INVALIDE'
  /** Restitution du dépôt demandée sans sortie connue. */
  | 'LOCATION_EN_COURS'
  | 'RETENUES_TROP_ELEVEES'
  /** Restitution ou régularisation de cette année déjà enregistrée (double clic, deux onglets). */
  | 'DEJA_ENREGISTRE'
  /** Un dépôt déjà rendu ne s'annule plus. */
  | 'DEPOT_RENDU'
  /** Année non proposée, forfait, ou aucune dépense récupérable. */
  | 'REGULARISATION_IMPOSSIBLE'
  | 'COLOCATAIRE_REFUSE'
  | 'BAILLEUR_MANQUANT'
  /** Dix colocataires en plus du locataire en titre. */
  | 'LIMITE_ATTEINTE';

export class ErreurFinBail extends Error {
  readonly code: CodeErreurFinBail;

  constructor(code: CodeErreurFinBail) {
    super(code);
    this.name = 'ErreurFinBail';
    this.code = code;
  }
}

/**
 * Congés, charges, dépôts, régularisations, mouvements de colocataires et décomptes d'un compte
 * (ADR-G34). Chaque méthode ne lit et n'écrit que les lignes de `userId`.
 */
export interface DepotFinBail {
  etat(userId: string): Promise<EtatFinBail>;
  /** Lève INTROUVABLE, DATE_INVALIDE, CONGE_INVALIDE, FIN_AVANT_ENTREE ou PAIEMENTS_APRES_SORTIE. */
  enregistrerConge(
    userId: string,
    locationId: string,
    saisie: CongeSaisie,
  ): Promise<CongeEnregistre>;
  /** Retire le congé et la sortie ; lève INTROUVABLE. */
  retirerConge(userId: string, locationId: string): Promise<CongeRetire>;
  /** Lève INTROUVABLE. */
  enregistrerModeCharges(
    userId: string,
    locationId: string,
    mode: ModeCharges,
  ): Promise<ModeChargesLocation>;
  /** Lève INTROUVABLE, LOCATION_EN_COURS, DATE_INVALIDE, RETENUES_TROP_ELEVEES, BAILLEUR_MANQUANT ou DEJA_ENREGISTRE. */
  restituer(
    userId: string,
    locationId: string,
    saisie: RestitutionSaisie,
  ): Promise<RestitutionEnregistree>;
  /** Lève INTROUVABLE ou DATE_INVALIDE. */
  rendreDepot(userId: string, locationId: string, rendueLe: string): Promise<Restitution>;
  /** Retire la restitution et son décompte ; lève INTROUVABLE ou DEPOT_RENDU. */
  annulerRestitution(userId: string, locationId: string): Promise<void>;
  /** Lève INTROUVABLE, REGULARISATION_IMPOSSIBLE, BAILLEUR_MANQUANT ou DEJA_ENREGISTRE. */
  regulariser(userId: string, locationId: string, annee: number): Promise<RegularisationValidee>;
  /** Lève INTROUVABLE ou DATE_INVALIDE. */
  reglerRegularisation(userId: string, id: string, regleeLe: string): Promise<Regularisation>;
  /** Lève INTROUVABLE, COLOCATAIRE_REFUSE ou LIMITE_ATTEINTE. */
  changerColocataire(
    userId: string,
    locationId: string,
    changement: ChangementColocataire,
  ): Promise<ColocataireChange>;
  /** Lève INTROUVABLE. */
  decompte(userId: string, id: string): Promise<DecompteComplet>;
}

/** Les tables de la migration 0011, et celle des dépenses (0007) que la régularisation lit. */
export const TABLES_FIN_BAIL = [
  'gestion_conge',
  'gestion_location_charges',
  'gestion_depot_restitution',
  'gestion_regularisation',
  'gestion_colocation_mouvement',
  'gestion_decompte',
  'gestion_depense',
] as const;

/** Une table de la fin du bail manque : la migration 0011 (ou 0007) n'est pas encore appliquée. */
export function estTableFinBailAbsente(erreur: unknown): boolean {
  const message = erreur instanceof Error ? erreur.message : '';
  return TABLES_FIN_BAIL.some((table) => new RegExp(`no such table: ${table}\\b`).test(message));
}
