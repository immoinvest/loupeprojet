import type {
  AccordLocataire,
  BailleurBien,
  ContactLocataire,
  Envoi,
  EtatEnvois,
  LectureAccord,
  ReponseAccord,
} from '@loupe/gestion';

/** Erreurs des envois traduites en codes stables ; les phrases sont dans `textes/gerer-envois.ts`. */
export type CodeErreurEnvois =
  /** La migration 0009 n'est pas appliquée : « Bientôt disponible ». */
  | 'indisponible'
  /** Pas d'envoyeur d'e-mails ou pas de clé de signature des liens. */
  | 'inactifs'
  | 'sans_email'
  | 'sans_accord'
  | 'envoi_recent'
  | 'invitation_recente'
  | 'envoi_echoue'
  /** Lien d'accord expiré, déjà utilisé, modifié, ou adresse changée. */
  | 'lien_invalide'
  | 'introuvable'
  | 'invalide'
  | 'non_connecte'
  | 'reseau'
  | 'inconnue';

export type ResultatEnvois<T> =
  | { readonly ok: true; readonly valeur: T }
  | { readonly ok: false; readonly code: CodeErreurEnvois };

export type TypeReponseAccord = ReponseAccord['reponse'];

/** Les routes /api/gestion/envois : version réseau et version mémoire (tests). */
export interface ClientEnvois {
  etat(): Promise<ResultatEnvois<EtatEnvois>>;
  /** « Mon locataire m'a déjà donné son accord ». */
  declarerAccord(locataireId: string): Promise<ResultatEnvois<AccordLocataire>>;
  /** « Renvoyer la demande ». */
  inviter(locataireId: string): Promise<ResultatEnvois<AccordLocataire>>;
  enregistrerContact(
    locataireId: string,
    telephone: string | null,
  ): Promise<ResultatEnvois<ContactLocataire>>;
  enregistrerBailleurBien(
    bienId: string,
    bailleur: BailleurBien | null,
  ): Promise<ResultatEnvois<{ readonly bailleur: BailleurBien | null }>>;
  /** Le même document, aux locataires qui l'ont accepté. */
  renvoyer(documentId: string): Promise<ResultatEnvois<Envoi[]>>;
}

/** Les routes publiques /api/accord : la page où le locataire répond, sans compte. */
export interface ClientAccord {
  lire(jeton: string): Promise<ResultatEnvois<LectureAccord>>;
  repondre(
    jeton: string,
    reponse: TypeReponseAccord,
  ): Promise<ResultatEnvois<{ readonly statut: TypeReponseAccord }>>;
}
