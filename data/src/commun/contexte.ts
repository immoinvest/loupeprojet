import { journalStandard, type Journal } from './journal.ts';

/**
 * Tout ce qui touche au monde extérieur passe par ce contexte, injecté depuis la ligne de commande :
 * les tests fournissent un faux `recuperer`, une pause instantanée et une horloge fixe.
 */
export interface Contexte {
  readonly recuperer: typeof fetch;
  readonly pause: (millisecondes: number) => Promise<void>;
  readonly horloge: () => Date;
  readonly journal: Journal;
  readonly dossierSortie: string;
}

export function contexteReel(dossierSortie: string): Contexte {
  return {
    recuperer: fetch,
    pause: (millisecondes) =>
      new Promise((resoudre) => {
        setTimeout(resoudre, millisecondes);
      }),
    horloge: () => new Date(),
    journal: journalStandard(process.env),
    dossierSortie,
  };
}
