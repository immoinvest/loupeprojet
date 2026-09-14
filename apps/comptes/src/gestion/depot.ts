import type {
  CreationLocation,
  CreationReponse,
  EtatGestion,
  NouveauPaiement,
  Paiement,
  PreferencesMenu,
} from '@loupe/gestion';

/** Les erreurs métier que les routes traduisent en réponses ; toute autre erreur est interne. */
export type CodeErreurGestion =
  | 'INTROUVABLE'
  | 'PERIODE_DEJA_RECUE'
  /** Un loyer marqué reçu avant l'entrée, après la sortie ou plus d'un an à l'avance. */
  | 'HORS_LOCATION'
  /** Le compte a atteint le nombre maximal de biens (borne contre l'abus du quota D1). */
  | 'LIMITE_ATTEINTE';

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
  /** Lève INTROUVABLE (location d'un autre compte) ou PERIODE_DEJA_RECUE. */
  payer(userId: string, paiement: NouveauPaiement): Promise<Paiement>;
  /** Lève INTROUVABLE si le paiement n'existe pas pour ce compte. */
  annulerPaiement(userId: string, paiementId: string): Promise<void>;
  enregistrerPreferences(userId: string, preferences: PreferencesMenu): Promise<PreferencesMenu>;
}

const TABLE_ABSENTE = 'no such table: gestion_';
const DOUBLON = 'UNIQUE constraint failed';

function message(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : '';
}

/** La base n'a pas encore reçu la migration 0002 (production pas encore migrée). */
export function estTableAbsente(erreur: unknown): boolean {
  return message(erreur).includes(TABLE_ABSENTE);
}

/** Une contrainte d'unicité a refusé l'écriture (même période payée deux fois). */
export function estDoublon(erreur: unknown): boolean {
  return message(erreur).includes(DOUBLON);
}
