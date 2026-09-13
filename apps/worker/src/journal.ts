/** Journal structuré : une ligne JSON par événement, lue par Workers Logs. Seul fichier autorisé à écrire sur la console. */
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

/** Journal muet qui garde les événements : pour les tests. */
export function journalMemoire(): Journal & {
  readonly evenements: { niveau: string; evenement: string; donnees?: unknown }[];
} {
  const evenements: { niveau: string; evenement: string; donnees?: unknown }[] = [];
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
