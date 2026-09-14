import type {
  CreationLocation,
  CreationReponse,
  DemandeDocument,
  DocumentComplet,
  EtatGestion,
  ExportGestion,
  IdentiteBailleur,
  Locataire,
  LocationGeree,
  ModificationLocation,
  NouveauPaiement,
  NouvelleOccupation,
  Paiement,
  PreferencesMenu,
} from '@loupe/gestion';

/** Les erreurs métier que les routes traduisent en réponses ; toute autre erreur est interne. */
export type CodeErreurGestion =
  | 'INTROUVABLE'
  /** Un loyer marqué reçu, ou un changement de montants, avant l'entrée, après la sortie ou plus d'un an à l'avance. */
  | 'HORS_LOCATION'
  /** Le compte a atteint le nombre maximal de biens (borne contre l'abus du quota D1). */
  | 'LIMITE_ATTEINTE'
  /** Ce paiement ferait dépasser ce qui est dû pour le mois. */
  | 'MONTANT_DEPASSE'
  /** Un paiement daté dans le futur. */
  | 'DATE_INVALIDE'
  /** Une quittance ou un reçu atteste ce paiement : il ne s'annule plus. */
  | 'DOCUMENT_EMIS'
  /** Pas encore de nom ni d'adresse de bailleur : la quittance ne peut pas être écrite. */
  | 'BAILLEUR_MANQUANT'
  /** Quittance demandée pour un mois pas entièrement reçu. */
  | 'LOYER_NON_REGLE'
  /** Reçu demandé pour le paiement qui solde le mois : c'est une quittance. */
  | 'LOYER_REGLE'
  /** Une sortie avant l'entrée. */
  | 'FIN_AVANT_ENTREE'
  /** Des loyers sont déjà reçus pour des mois après la sortie demandée. */
  | 'PAIEMENTS_APRES_SORTIE'
  /** La nouvelle location chevauche une location du bien au même libellé. */
  | 'BIEN_OCCUPE'
  /** Un paiement existe pour le mois du changement de montants ou après (ADR-G15). */
  | 'PERIODE_PAYEE';

/** Un document rendu par l'émission : `nouveau` est faux s'il existait déjà (même clé). */
export interface Emission {
  readonly document: DocumentComplet;
  readonly nouveau: boolean;
}

/** Le locataire, ses colocataires et la location créés en louant un bien. */
export interface OccupationCreee {
  readonly locataire: Locataire;
  readonly location: LocationGeree;
  readonly colocataires: readonly Locataire[];
}

export class ErreurGestion extends Error {
  readonly code: CodeErreurGestion;

  constructor(code: CodeErreurGestion) {
    super(code);
    this.name = 'ErreurGestion';
    this.code = code;
  }
}

/**
 * Les données de gestion d'un compte. Chaque méthode ne lit et n'écrit que les lignes de `userId` :
 * une ressource d'un autre compte est « introuvable », jamais « interdite » (on ne confirme pas qu'elle existe).
 */
export interface DepotGestion {
  etat(userId: string): Promise<EtatGestion>;
  /** Le bien, et s'il est loué son locataire et sa location, écrits ensemble ou pas du tout. */
  creer(userId: string, creation: CreationLocation): Promise<CreationReponse>;
  /**
   * Lève INTROUVABLE (location d'un autre compte), HORS_LOCATION, DATE_INVALIDE ou MONTANT_DEPASSE
   * (la somme des paiements du mois ne dépasse jamais le dû, garanti à l'insertion).
   */
  payer(userId: string, paiement: NouveauPaiement): Promise<Paiement>;
  /** Lève INTROUVABLE si le paiement n'existe pas pour ce compte, DOCUMENT_EMIS s'il est attesté. */
  annulerPaiement(userId: string, paiementId: string): Promise<void>;
  enregistrerPreferences(userId: string, preferences: PreferencesMenu): Promise<PreferencesMenu>;
  /** Le nom et l'adresse du bailleur, repris sur ses documents. */
  enregistrerBailleur(userId: string, identite: IdentiteBailleur): Promise<IdentiteBailleur>;
  /**
   * Émission idempotente d'un document figé ; lève INTROUVABLE, BAILLEUR_MANQUANT, HORS_LOCATION,
   * LOYER_NON_REGLE ou LOYER_REGLE.
   */
  emettreDocument(userId: string, demande: DemandeDocument): Promise<Emission>;
  /** Lève INTROUVABLE. */
  document(userId: string, id: string): Promise<DocumentComplet>;
  /** Lève INTROUVABLE, FIN_AVANT_ENTREE ou PAIEMENTS_APRES_SORTIE. */
  terminerLocation(userId: string, locationId: string, fin: string): Promise<LocationGeree>;
  /** Lève INTROUVABLE, BIEN_OCCUPE ou LIMITE_ATTEINTE. */
  louer(userId: string, bienId: string, occupation: NouvelleOccupation): Promise<OccupationCreee>;
  /** Montants à partir d'un mois, jour, dépôt, libellé ; lève INTROUVABLE, HORS_LOCATION, PERIODE_PAYEE ou BIEN_OCCUPE. */
  modifierLocation(
    userId: string,
    locationId: string,
    modification: ModificationLocation,
  ): Promise<LocationGeree>;
  /** Toutes les données de gestion du compte, documents complets compris. */
  exporter(userId: string): Promise<ExportGestion>;
}

const TABLE_ABSENTE = 'no such table: gestion_';

function message(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : '';
}

/** La base n'a pas encore reçu une migration de gestion (0002, 0003 ou 0005 pas encore appliquée). */
export function estTableAbsente(erreur: unknown): boolean {
  return message(erreur).includes(TABLE_ABSENTE);
}
