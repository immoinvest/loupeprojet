/**
 * Journal structuré : une ligne JSON par événement sur la sortie d'erreur (jamais `console`),
 * doublée d'une annotation GitHub (`::warning::`, `::error::`) quand le script tourne dans une Action.
 */

export type NiveauJournal = 'info' | 'avertissement' | 'erreur';
export type Details = Readonly<Record<string, unknown>>;

export interface Journal {
  info(message: string, details?: Details): void;
  avertissement(message: string, details?: Details): void;
  erreur(message: string, details?: Details): void;
}

export interface OptionsJournal {
  readonly ecrire: (ligne: string) => void;
  readonly horloge: () => Date;
  readonly annotationsGitHub: boolean;
}

const ANNOTATIONS: Readonly<Record<NiveauJournal, string | null>> = {
  info: null,
  avertissement: 'warning',
  erreur: 'error',
};

export function creerJournal(options: OptionsJournal): Journal {
  const emettre = (niveau: NiveauJournal, message: string, details: Details = {}): void => {
    options.ecrire(
      JSON.stringify({ horodatage: options.horloge().toISOString(), niveau, message, ...details }),
    );
    const annotation = ANNOTATIONS[niveau];
    if (options.annotationsGitHub && annotation !== null) {
      options.ecrire(`::${annotation}::${message}`);
    }
  };
  return {
    info: (message, details) => {
      emettre('info', message, details);
    },
    avertissement: (message, details) => {
      emettre('avertissement', message, details);
    },
    erreur: (message, details) => {
      emettre('erreur', message, details);
    },
  };
}

/** Journal réel : sortie d'erreur du processus, annotations si `GITHUB_ACTIONS` vaut `true`. */
export function journalStandard(env: Readonly<Record<string, string | undefined>>): Journal {
  return creerJournal({
    ecrire: (ligne) => {
      process.stderr.write(`${ligne}\n`);
    },
    horloge: () => new Date(),
    annotationsGitHub: env.GITHUB_ACTIONS === 'true',
  });
}
