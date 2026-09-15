import { z } from 'zod';

import { IdentiteBailleurSchema } from './documents';

/*
 * Quittances envoyées par e-mail (G2-1, G2-2). La transmission dématérialisée de la quittance
 * demande l'accord exprès du locataire et reste gratuite (loi n° 89-462 du 6 juillet 1989, art. 21).
 * Accords, traces d'envoi, téléphone et identité de bailleur par bien vivent dans des tables
 * latérales lues par les routes `/api/gestion/envois` (ADR-G42 à G46).
 */

const IdentifiantSchema = z.string().min(1).max(100);
const HorodatageSchema = z.string().min(1).max(40);

/** Règles d'envoi, datées. Les délais sont des choix Deklic, pas des règles légales. */
export const REGLES_ENVOIS = {
  version: '2026-09',
  /** Validité du lien d'accord envoyé au locataire. */
  dureeJetonJours: 30,
  /** Un premier essai, puis une nouvelle tentative (G2-2). */
  tentatives: 2,
  /** Après « Reçu » : « Annuler » reste proposé 10 s, l'envoi part ensuite (ADR-G43). */
  delaiQuittanceSecondes: 12,
  /** Entre deux « Renvoyer » d'un même document. */
  intervalleRenvoiMinutes: 1,
  /** Entre deux invitations d'un même locataire. */
  intervalleInvitationHeures: 24,
} as const;

/**
 * Art. 21 (version en vigueur depuis le 27/03/2014, vérifiée sur Légifrance le 15/09/2026) : « Avec
 * l'accord exprès du locataire, le bailleur peut procéder à la transmission dématérialisée de la
 * quittance. » et « Aucuns frais liés à la gestion de l'avis d'échéance ou de la quittance ne peuvent
 * être facturés au locataire. »
 */
export const ENVOI_DEMATERIALISE = {
  source: 'Loi n° 89-462 du 6 juillet 1989, article 21',
  aConfirmer: false,
} as const;

/** Ce qui est enregistré : invité, accepté par le lien, refusé par le lien, déclaré par le bailleur. */
export const STATUTS_ACCORD = ['en_attente', 'accorde', 'refuse', 'declare_par_bailleur'] as const;
export type StatutAccord = (typeof STATUTS_ACCORD)[number];
export const StatutAccordSchema = z.enum(STATUTS_ACCORD);

/** Ce que l'écran montre : l'enregistré, ou pas d'e-mail, ou rien demandé pour l'adresse actuelle. */
export const STATUTS_ACCORD_EFFECTIFS = ['sans_email', 'non_demande', ...STATUTS_ACCORD] as const;
export type StatutAccordEffectif = (typeof STATUTS_ACCORD_EFFECTIFS)[number];
export const StatutAccordEffectifSchema = z.enum(STATUTS_ACCORD_EFFECTIFS);

/** SHA-256 hexadécimal d'une adresse normalisée : l'adresse elle-même n'est jamais gardée (ADR-G42). */
export const EmpreinteSchema = z.string().regex(/^[0-9a-f]{64}$/);

export interface AccordEnregistre {
  readonly statut: StatutAccord;
  readonly emailEmpreinte: string;
}

/** Minuscules, sans espaces autour : deux écritures d'une même adresse donnent la même empreinte. */
export function normaliserEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Le statut d'accord pour l'adresse actuelle : un accord donné pour une autre adresse ne vaut plus. */
export function statutAccord(
  accord: AccordEnregistre | undefined,
  empreinteActuelle: string | undefined,
): StatutAccordEffectif {
  if (empreinteActuelle === undefined) return 'sans_email';
  if (accord?.emailEmpreinte !== empreinteActuelle) return 'non_demande';
  return accord.statut;
}

/** Seuls ces deux statuts permettent d'envoyer une quittance par e-mail. */
export function accordValide(statut: StatutAccordEffectif): boolean {
  return statut === 'accorde' || statut === 'declare_par_bailleur';
}

/** « julie.martin@exemple.fr » → « julie.martin@… » : la trace d'envoi ne garde pas le domaine. */
export function masquerEmail(email: string): string {
  const arobase = email.lastIndexOf('@');
  return arobase <= 0 ? '…' : `${email.slice(0, arobase)}@…`;
}

export interface LocataireJoignable {
  readonly id: string;
  readonly email?: string | undefined;
}

/**
 * Les locataires du bail (en titre puis colocataires) qui ont un e-mail et un accord valide, tels
 * qu'ils ont été passés, l'e-mail garanti.
 */
export function destinatairesQuittance<T extends LocataireJoignable>(
  location: { readonly locataireId: string; readonly colocataireIds: readonly string[] },
  locataires: readonly T[],
  statuts: ReadonlyMap<string, StatutAccordEffectif>,
): (T & { readonly email: string })[] {
  return [location.locataireId, ...location.colocataireIds].flatMap((id) => {
    const locataire = locataires.find((l) => l.id === id);
    const statut = statuts.get(id) ?? 'non_demande';
    if (locataire?.email === undefined || !accordValide(statut)) return [];
    return [{ ...locataire, email: locataire.email }];
  });
}

function ecartMs(avant: string, apres: string): number {
  return Date.parse(apres) - Date.parse(avant);
}

/** Une nouvelle invitation : jamais envoyée, ou la précédente date d'au moins 24 h. */
export function invitationPossible(invitationLe: string | undefined, maintenant: string): boolean {
  if (invitationLe === undefined) return true;
  return ecartMs(invitationLe, maintenant) >= REGLES_ENVOIS.intervalleInvitationHeures * 3_600_000;
}

/** « Renvoyer » : le dernier essai date d'au moins une minute. */
export function renvoiPossible(dernierEssaiLe: string, maintenant: string): boolean {
  return ecartMs(dernierEssaiLe, maintenant) >= REGLES_ENVOIS.intervalleRenvoiMinutes * 60_000;
}

/** L'expiration d'un lien d'accord créé à `maintenant`, en horodatage ISO. */
export function expirationJeton(maintenant: string): string {
  return new Date(
    Date.parse(maintenant) + REGLES_ENVOIS.dureeJetonJours * 86_400_000,
  ).toISOString();
}

export const STATUTS_ENVOI = ['envoye', 'echec'] as const;
export type StatutEnvoi = (typeof STATUTS_ENVOI)[number];

/** La trace d'un document envoyé à un locataire (ADR-G45). */
export const EnvoiSchema = z.object({
  id: IdentifiantSchema,
  documentId: IdentifiantSchema,
  locataireId: IdentifiantSchema,
  /** Adresse masquée (`julie@…`). */
  destinataire: z.string().min(1).max(260),
  statut: z.enum(STATUTS_ENVOI),
  tentatives: z.number().int().min(1),
  dernierEssaiLe: HorodatageSchema,
  /** Le dernier envoi réussi. */
  envoyeLe: HorodatageSchema.optional(),
});
export type Envoi = z.infer<typeof EnvoiSchema>;

/** Les locataires dont le dernier envoi a échoué : « E-mail de Julie à vérifier ». */
export function locatairesAVerifier(envois: readonly Envoi[]): string[] {
  const derniers = new Map<string, Envoi>();
  for (const envoi of envois) {
    const connu = derniers.get(envoi.locataireId);
    if (connu === undefined || connu.dernierEssaiLe <= envoi.dernierEssaiLe) {
      derniers.set(envoi.locataireId, envoi);
    }
  }
  return [...derniers.values()].filter((e) => e.statut === 'echec').map((e) => e.locataireId);
}

/** `reel` : Resend ; `journal` : développement, rien ne part ; `inactif` : pas d'envoyeur ou pas de clé de jetons. */
export const MODES_ENVOI = ['reel', 'journal', 'inactif'] as const;
export type ModeEnvoi = (typeof MODES_ENVOI)[number];

export const TelephoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 .-]{4,22}[0-9]$/);

/** `null` retire le téléphone. */
export const ContactLocataireSchema = z.object({ telephone: TelephoneSchema.nullable() });
export type ContactLocataire = z.infer<typeof ContactLocataireSchema>;

export const TYPES_BAILLEUR = ['personne', 'sci'] as const;
export type TypeBailleur = (typeof TYPES_BAILLEUR)[number];

/** L'identité du bailleur d'un bien (une SCI, un indivisaire) ; sans elle, celle du compte. */
export const BailleurBienSchema = IdentiteBailleurSchema.extend({ type: z.enum(TYPES_BAILLEUR) });
export type BailleurBien = z.infer<typeof BailleurBienSchema>;

/** `null` retire l'identité propre au bien. */
export const SaisieBailleurBienSchema = z.object({ bailleur: BailleurBienSchema.nullable() });

export const AccordLocataireSchema = z.object({
  locataireId: IdentifiantSchema,
  statut: StatutAccordEffectifSchema,
  /** Date de la réponse ou de la déclaration. */
  le: HorodatageSchema.optional(),
  invitationLe: HorodatageSchema.optional(),
});
export type AccordLocataire = z.infer<typeof AccordLocataireSchema>;

export const EtatEnvoisSchema = z.object({
  mode: z.enum(MODES_ENVOI),
  /** Les liens d'accord peuvent partir (envoyeur et clé de signature présents). */
  invitations: z.boolean(),
  accords: z.array(AccordLocataireSchema),
  envois: z.array(EnvoiSchema),
  contacts: z.array(z.object({ locataireId: IdentifiantSchema, telephone: TelephoneSchema })),
  bailleursBiens: z.array(BailleurBienSchema.extend({ bienId: IdentifiantSchema })),
});
export type EtatEnvois = z.infer<typeof EtatEnvoisSchema>;

/** Le jeton d'un lien d'accord : `<id>.<expiration>.<signature>` (ADR-G41). */
export const JetonAccordSchema = z
  .string()
  .min(10)
  .max(300)
  .regex(/^[A-Za-z0-9_-]+\.[0-9]+\.[A-Za-z0-9_-]+$/);

export const DemandeLectureAccordSchema = z.object({ jeton: JetonAccordSchema });
export const ReponseAccordSchema = z.object({
  jeton: JetonAccordSchema,
  reponse: z.enum(['accorde', 'refuse']),
});
export type ReponseAccord = z.infer<typeof ReponseAccordSchema>;

/** Ce que la page publique affiche : le prénom, le bailleur et le logement, rien de plus. */
export const LectureAccordSchema = z.object({
  prenom: z.string().min(1).max(80),
  bailleur: z.string().min(1).max(120).nullable(),
  logement: z.string().min(1).max(400).nullable(),
});
export type LectureAccord = z.infer<typeof LectureAccordSchema>;
