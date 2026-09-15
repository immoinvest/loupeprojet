import type { BailleurBien, Envoi, StatutAccord, StatutEnvoi } from '@loupe/gestion';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** Les refus propres aux envois, traduits en réponses par les routes. */
export type CodeErreurEnvois =
  | 'INTROUVABLE'
  /** Le locataire n'a pas d'e-mail. */
  | 'SANS_EMAIL'
  /** Aucun locataire du bail n'a d'accord valide pour son adresse actuelle. */
  | 'SANS_ACCORD'
  /** Un envoi de ce document a eu lieu il y a moins d'une minute. */
  | 'ENVOI_RECENT'
  /** Une invitation est partie il y a moins de 24 h. */
  | 'INVITATION_RECENTE'
  /** Pas d'envoyeur d'e-mails, ou pas de clé de signature des liens. */
  | 'ENVOIS_INACTIFS'
  /** Le fournisseur a refusé l'e-mail deux fois. */
  | 'ENVOI_ECHOUE';

export const STATUTS_ERREUR_ENVOIS: Readonly<Record<CodeErreurEnvois, ContentfulStatusCode>> = {
  INTROUVABLE: 404,
  SANS_EMAIL: 409,
  SANS_ACCORD: 409,
  ENVOI_RECENT: 429,
  INVITATION_RECENTE: 429,
  ENVOIS_INACTIFS: 409,
  ENVOI_ECHOUE: 502,
};

export class ErreurEnvois extends Error {
  readonly code: CodeErreurEnvois;

  constructor(code: CodeErreurEnvois) {
    super(code);
    this.name = 'ErreurEnvois';
    this.code = code;
  }
}

export interface LocataireContact {
  readonly id: string;
  readonly prenom: string;
  readonly nom: string;
  readonly email?: string;
}

export interface AccordLigne {
  readonly locataireId: string;
  readonly statut: StatutAccord;
  readonly emailEmpreinte: string;
  readonly le?: string;
  readonly invitationLe?: string;
}

export interface JetonValide {
  readonly id: string;
  readonly userId: string;
  readonly locataireId: string;
  readonly emailEmpreinte: string;
}

export interface LocationEtLocataires {
  readonly location: {
    readonly id: string;
    readonly locataireId: string;
    readonly colocataireIds: readonly string[];
  };
  /** Le locataire en titre et les colocataires. */
  readonly locataires: readonly LocataireContact[];
}

/** Ce que l'invitation et la page publique nomment. */
export interface ContexteInvitation {
  readonly bailleur: string | null;
  readonly logement: string | null;
}

export interface NouvelleInvitation {
  readonly locataireId: string;
  readonly emailEmpreinte: string;
  readonly jetonId: string;
  readonly expireLe: string;
  readonly maintenant: string;
}

export interface ResultatEnvoi {
  readonly documentId: string;
  readonly locataireId: string;
  /** Masqué. */
  readonly destinataire: string;
  readonly statut: StatutEnvoi;
  readonly tentatives: number;
  readonly maintenant: string;
}

export type BailleurDuBien = BailleurBien & { readonly bienId: string };

/**
 * Les tables latérales de `quittances-auto` (migration 0009). Toute méthode ne lit et n'écrit que les
 * lignes de `userId`, sauf les jetons, retrouvés par leur identifiant signé.
 */
export interface DepotEnvois {
  locataires(userId: string): Promise<LocataireContact[]>;
  locataire(userId: string, locataireId: string): Promise<LocataireContact | null>;
  locationEtLocataires(userId: string, locationId: string): Promise<LocationEtLocataires | null>;
  accords(userId: string): Promise<AccordLigne[]>;
  envois(userId: string): Promise<Envoi[]>;
  envoisDuDocument(userId: string, documentId: string): Promise<Envoi[]>;
  contacts(userId: string): Promise<{ locataireId: string; telephone: string }[]>;
  bailleursBiens(userId: string): Promise<BailleurDuBien[]>;
  contexteInvitation(userId: string, locataireId: string): Promise<ContexteInvitation>;
  /** L'adresse du compte, en réponse des e-mails au locataire (ADR-G46). */
  emailCompte(userId: string): Promise<string | null>;
  /** Le jeton et l'accord « en attente », d'un bloc. */
  enregistrerInvitation(userId: string, invitation: NouvelleInvitation): Promise<void>;
  enregistrerAccord(
    userId: string,
    locataireId: string,
    statut: Exclude<StatutAccord, 'en_attente'>,
    emailEmpreinte: string,
    maintenant: string,
  ): Promise<void>;
  /** Un jeton non utilisé et non expiré. */
  jetonValide(id: string, maintenant: string): Promise<JetonValide | null>;
  /** Le même, marqué utilisé en une écriture conditionnelle ; `null` s'il l'était déjà. */
  consommerJeton(id: string, maintenant: string): Promise<JetonValide | null>;
  /** Lève INTROUVABLE. `null` retire le téléphone. */
  enregistrerContact(
    userId: string,
    locataireId: string,
    telephone: string | null,
    maintenant: string,
  ): Promise<void>;
  /** Lève INTROUVABLE. `null` retire l'identité propre au bien. */
  enregistrerBailleurBien(
    userId: string,
    bienId: string,
    bailleur: BailleurBien | null,
    maintenant: string,
  ): Promise<void>;
  enregistrerEnvoi(userId: string, resultat: ResultatEnvoi): Promise<void>;
}

export const TABLES_ENVOIS = [
  'gestion_locataire_contact',
  'gestion_bien_bailleur',
  'gestion_accord',
  'gestion_jeton',
  'gestion_envoi',
] as const;

/** La migration 0009 n'est pas encore appliquée. */
export function estTableEnvoisAbsente(erreur: unknown): boolean {
  const message = erreur instanceof Error ? erreur.message : '';
  return TABLES_ENVOIS.some((table) => new RegExp(`no such table: ${table}\\b`).test(message));
}
