import { z } from 'zod';

import { migrerEnregistre, ProjetEnregistreSchema, type ProjetEnregistre } from './enregistre';

/** Projets actifs par compte : au-delà d'un investisseur particulier, et une borne du quota D1. */
export const LIMITE_PROJETS = 200;

/** Changements par requête : un lot reste sous le corps maximal et sous les 10 ms de CPU du worker. */
export const MAX_CHANGEMENTS = 10;

/** Taille d'un projet sérialisé (caractères JSON) ; une visite complète avec ses notes pèse ~25 Ko. */
export const TAILLE_MAX_PROJET = 64_000;

/** Corps maximal d'une requête de synchronisation (octets) : 10 projets de 64 Ko et l'enveloppe. */
export const TAILLE_MAX_REQUETE = 720 * 1024;

/** Projets renvoyés par réponse ; la suite se lit en rappelant avec le curseur. */
export const PAGE_PROJETS = 25;

export const IdProjetSchema = z.string().min(1).max(64);

/** Une date ISO 8601 en UTC, telle que `Date.toISOString()` la produit : comparable comme texte. */
export const DateIsoSchema = z.iso.datetime();

/** Un projet envoyé au compte : migré depuis un format antérieur, validé, daté en ISO, 64 Ko au plus. */
export const ProjetEnvoyeSchema = z
  .preprocess(
    migrerEnregistre,
    ProjetEnregistreSchema.extend({ id: IdProjetSchema, modifieLe: DateIsoSchema }),
  )
  .refine((p) => JSON.stringify(p).length <= TAILLE_MAX_PROJET, { message: 'projet trop gros' });

export const ChangementSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('enregistrer'), projet: ProjetEnvoyeSchema }),
  z.object({ type: z.literal('supprimer'), id: IdProjetSchema, le: DateIsoSchema }),
]);
export type Changement = z.infer<typeof ChangementSchema>;

/** L'identifiant visé par un changement. */
export function idDe(changement: Changement): string {
  return changement.type === 'enregistrer' ? changement.projet.id : changement.id;
}

export const RequeteSynchroSchema = z
  .object({
    /** La dernière révision du compte déjà reçue par l'appareil (0 : aucune). */
    depuis: z.number().int().nonnegative(),
    changements: z.array(ChangementSchema).max(MAX_CHANGEMENTS),
  })
  .refine((r) => new Set(r.changements.map(idDe)).size === r.changements.length, {
    message: 'un projet par changement',
  });
export type RequeteSynchro = z.infer<typeof RequeteSynchroSchema>;

export interface ReponseSynchro {
  /** La révision jusqu'à laquelle l'appareil est à jour après cette réponse. */
  readonly curseur: number;
  /** Vrai : d'autres projets modifiés restent à lire (rappeler avec `curseur`). */
  readonly suite: boolean;
  /** Tous les projets actifs du compte : un projet synchronisé absent a été supprimé ailleurs. */
  readonly ids: readonly string[];
  /** Projets nouveaux refusés : le compte a atteint `LIMITE_PROJETS`. */
  readonly refuses: readonly string[];
  /** Projets modifiés ailleurs, ou dont la version du compte est plus récente que celle envoyée. */
  readonly projets: readonly ProjetEnregistre[];
}

const EnveloppeSchema = z.object({
  curseur: z.number().int().nonnegative(),
  suite: z.boolean(),
  ids: z.array(IdProjetSchema),
  refuses: z.array(IdProjetSchema),
  projets: z.array(z.unknown()),
});

const ProjetRecuSchema = z.preprocess(migrerEnregistre, ProjetEnregistreSchema);

/**
 * La réponse du serveur, revalidée. Un projet illisible est écarté sans bloquer les autres : sa copie
 * locale, s'il en a une, reste sur l'appareil (il figure dans `ids`). Enveloppe invalide : `null`.
 */
export function lireReponse(brut: unknown): ReponseSynchro | null {
  const enveloppe = EnveloppeSchema.safeParse(brut);
  if (!enveloppe.success) return null;
  const projets: ProjetEnregistre[] = [];
  for (const candidat of enveloppe.data.projets) {
    const lu = ProjetRecuSchema.safeParse(candidat);
    if (lu.success) projets.push(lu.data);
  }
  return { ...enveloppe.data, projets };
}
