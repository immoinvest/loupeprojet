/**
 * Journal structuré : une ligne JSON par événement, lue par Workers Logs. Seul fichier autorisé à écrire
 * sur la console (même contrat que apps/worker/src/journal.ts). Jamais d'adresse e-mail, de code ni d'IP.
 */
export interface Journal {
  info(evenement: string, donnees?: Readonly<Record<string, unknown>>): void;
  erreur(evenement: string, donnees?: Readonly<Record<string, unknown>>): void;
}

function ligne(
  niveau: 'info' | 'erreur',
  evenement: string,
  donnees: Readonly<Record<string, unknown>> | undefined,
): string {
  return JSON.stringify({ niveau, evenement, ...donnees });
}

export const journalConsole: Journal = {
  info(evenement, donnees) {
    console.log(ligne('info', evenement, donnees));
  },
  erreur(evenement, donnees) {
    console.error(ligne('erreur', evenement, donnees));
  },
};

export interface Evenement {
  readonly niveau: 'info' | 'erreur';
  readonly evenement: string;
  readonly donnees?: Readonly<Record<string, unknown>> | undefined;
}

/** Journal muet qui garde les événements : pour les tests. */
export function journalMemoire(): Journal & { readonly evenements: Evenement[] } {
  const evenements: Evenement[] = [];
  return {
    evenements,
    info(evenement, donnees) {
      evenements.push({ niveau: 'info', evenement, donnees });
    },
    erreur(evenement, donnees) {
      evenements.push({ niveau: 'erreur', evenement, donnees });
    },
  };
}
