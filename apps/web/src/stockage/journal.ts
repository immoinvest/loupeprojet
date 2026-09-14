import { JOURNAL_VIDE, JournalSynchroSchema, type JournalSynchro } from '@loupe/projets';

/** Le journal de synchronisation de l'appareil, à côté de la liste des projets. */
export const CLE_JOURNAL = 'loupe.synchro.v1';

/** Lit le journal ; absent, illisible ou invalide : un journal neuf (les projets ne sont pas touchés). */
export function lireJournal(stockage: Storage): JournalSynchro {
  const brut = stockage.getItem(CLE_JOURNAL);
  if (brut === null) return JOURNAL_VIDE;
  try {
    const lu = JournalSynchroSchema.safeParse(JSON.parse(brut));
    return lu.success ? lu.data : JOURNAL_VIDE;
  } catch {
    return JOURNAL_VIDE;
  }
}

export function ecrireJournal(stockage: Storage, journal: JournalSynchro): void {
  stockage.setItem(CLE_JOURNAL, JSON.stringify(journal));
}
