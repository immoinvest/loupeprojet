import { creerApp } from '../src/app';
import type { Dependances } from '../src/dependances';
import { journalMemoire } from '../src/journal';

export interface Banc {
  readonly deps: Dependances;
  readonly journal: ReturnType<typeof journalMemoire>;
  readonly horloge: { valeur: number };
  readonly requete: (chemin: string, init?: RequestInit) => Promise<Response>;
}

/** Une application avec des doubles : journal mémoire, horloge pilotée, aucun fournisseur. */
export function banc(surcharges: Partial<Dependances> = {}): Banc {
  const horloge = { valeur: Date.parse('2026-09-13T10:00:00Z') };
  const journal = journalMemoire();
  const deps: Dependances = {
    environnement: 'dev',
    secret: 'secret-de-test-assez-long-pour-better-auth-0123',
    fournisseurs: {},
    origines: ['http://localhost:5173'],
    journal,
    maintenant: () => horloge.valeur,
    ...surcharges,
  };
  const app = creerApp(deps);
  return {
    deps,
    journal,
    horloge,
    requete: (chemin, init) => Promise.resolve(app.request(chemin, init)),
  };
}
