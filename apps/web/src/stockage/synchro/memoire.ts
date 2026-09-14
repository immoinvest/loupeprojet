import {
  idDe,
  LIMITE_PROJETS,
  PAGE_PROJETS,
  type ProjetEnregistre,
  type ReponseSynchro,
} from '@loupe/projets';

import type { ClientProjets, CodeErreurSynchro, DemandeSynchro, ResultatSynchro } from './types';

export interface OptionsProjetsMemoire {
  /** Les projets déjà sur le compte, dans l'ordre de leur révision. */
  readonly projets?: readonly ProjetEnregistre[];
  readonly limite?: number;
  readonly page?: number;
  readonly maintenant?: () => string;
}

export interface ClientProjetsMemoire extends ClientProjets {
  /** Chaque demande reçue, dans l'ordre. */
  readonly demandes: DemandeSynchro[];
  /** Les projets actifs du compte, dans l'ordre de leur révision. */
  readonly distants: () => ProjetEnregistre[];
  /** Fait échouer les demandes suivantes avec ce code (`null` : plus d'échec). */
  readonly echouer: (code: CodeErreurSynchro | null) => void;
}

interface Ligne {
  readonly projet: ProjetEnregistre | null;
  readonly modifieLe: string;
  readonly revision: number;
}

/** Un compte sans réseau qui applique les règles de l'API (dernière modification gagne, limite, pages). */
export function clientProjetsMemoire(options: OptionsProjetsMemoire = {}): ClientProjetsMemoire {
  const limite = options.limite ?? LIMITE_PROJETS;
  const taillePage = options.page ?? PAGE_PROJETS;
  const horloge = options.maintenant ?? ((): string => new Date().toISOString());
  const lignes = new Map<string, Ligne>();
  let revision = 0;
  for (const projet of options.projets ?? []) {
    revision += 1;
    lignes.set(projet.id, { projet, modifieLe: projet.modifieLe, revision });
  }
  const demandes: DemandeSynchro[] = [];
  let erreur: CodeErreurSynchro | null = null;

  const actives = (): [string, Ligne & { projet: ProjetEnregistre }][] =>
    [...lignes.entries()]
      .filter((e): e is [string, Ligne & { projet: ProjetEnregistre }] => e[1].projet !== null)
      .sort((a, b) => a[1].revision - b[1].revision);

  function appliquer({ depuis, changements }: DemandeSynchro): ReponseSynchro {
    const maintenant = horloge();
    const acceptes = new Set<string>();
    const refuses: string[] = [];
    const perdus: string[] = [];
    for (const changement of changements) {
      const id = idDe(changement);
      const date = changement.type === 'enregistrer' ? changement.projet.modifieLe : changement.le;
      const retenue = date > maintenant ? maintenant : date;
      const connue = lignes.get(id);
      const gagne = connue === undefined || retenue >= connue.modifieLe;
      const actif = connue !== undefined && connue.projet !== null;
      const projet = changement.type === 'enregistrer' ? changement.projet : null;
      if (projet !== null && gagne && !actif && actives().length >= limite) {
        refuses.push(id);
      } else if (gagne) {
        revision += 1;
        lignes.set(id, { projet, modifieLe: retenue, revision });
        acceptes.add(id);
      } else if (projet !== null) {
        perdus.push(id);
      }
    }
    const debut = depuis > revision ? 0 : depuis;
    const modifies = actives().filter(([, l]) => l.revision > debut);
    const suite = modifies.length > taillePage;
    const page = modifies.slice(0, taillePage);
    const curseur = suite ? Math.max(debut, ...page.map(([, l]) => l.revision)) : revision;
    const aRenvoyer = new Map<string, ProjetEnregistre>();
    const perdusActifs = actives().filter(([id]) => perdus.includes(id));
    for (const [id, l] of [...page, ...perdusActifs]) {
      if (!acceptes.has(id)) aRenvoyer.set(id, l.projet);
    }
    return {
      curseur,
      suite,
      ids: actives().map(([id]) => id),
      refuses,
      projets: [...aRenvoyer.values()],
    };
  }

  return {
    demandes,
    distants: () => actives().map(([, l]) => l.projet),
    echouer: (code) => {
      erreur = code;
    },
    synchroniser: (demande) => {
      demandes.push(demande);
      const resultat: ResultatSynchro<ReponseSynchro> =
        erreur === null ? { ok: true, valeur: appliquer(demande) } : { ok: false, code: erreur };
      return Promise.resolve(resultat);
    },
  };
}
