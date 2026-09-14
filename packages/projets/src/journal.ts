import { z } from 'zod';

/**
 * Ce que l'appareil retient de la synchronisation, à côté de ses projets. Tant que `compte` est
 * `null`, l'appareil n'est lié à aucun compte et rien n'est noté.
 */
export const JournalSynchroSchema = z.object({
  /** Identifiant du compte auquel les projets synchronisés appartiennent. */
  compte: z.string().min(1).nullable(),
  curseur: z.number().int().nonnegative(),
  /** Vrai jusqu'à la première réponse pour ce compte : l'appareil lit avant d'envoyer. */
  premiere: z.boolean(),
  /** Les projets actifs du compte à la dernière réponse. */
  synchronises: z.array(z.string()),
  /** Projets créés ou modifiés sur l'appareil, pas encore confirmés par le compte. */
  aEnvoyer: z.array(z.string()),
  /** Projets supprimés sur l'appareil, avec la date de suppression. */
  aSupprimer: z.record(z.string(), z.string()),
});
export type JournalSynchro = z.infer<typeof JournalSynchroSchema>;

export const JOURNAL_VIDE: JournalSynchro = {
  compte: null,
  curseur: 0,
  premiere: false,
  synchronises: [],
  aEnvoyer: [],
  aSupprimer: {},
};

/** Retire une clé d'un objet sans toucher à l'original. */
export function sansCle(
  objet: Readonly<Record<string, string>>,
  cle: string,
): Record<string, string> {
  return Object.fromEntries(Object.entries(objet).filter(([c]) => c !== cle));
}

/** Un projet créé ou modifié sur l'appareil. */
export function noterEnregistrement(journal: JournalSynchro, id: string): JournalSynchro {
  if (journal.compte === null) return journal;
  return {
    ...journal,
    aEnvoyer: journal.aEnvoyer.includes(id) ? journal.aEnvoyer : [...journal.aEnvoyer, id],
    aSupprimer: sansCle(journal.aSupprimer, id),
  };
}

/** Un projet supprimé sur l'appareil, à la date `le`. */
export function noterSuppression(journal: JournalSynchro, id: string, le: string): JournalSynchro {
  if (journal.compte === null) return journal;
  return {
    ...journal,
    aEnvoyer: journal.aEnvoyer.filter((x) => x !== id),
    aSupprimer: { ...sansCle(journal.aSupprimer, id), [id]: le },
  };
}
