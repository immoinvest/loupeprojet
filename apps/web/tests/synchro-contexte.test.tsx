import { projetExemple, ProjetSchema } from '@loupe/moteur';
import { NOM_EXEMPLE, type ProjetEnregistre } from '@loupe/projets';
import { act, renderHook, waitFor, type RenderHookResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CompteProvider, useCompte, type ContexteCompte } from '@/compte/CompteContext';
import { clientMemoire } from '@/compte/memoire';
import type { ClientCompte, Utilisateur } from '@/compte/types';
import { lireJournal } from '@/stockage/journal';
import { ProjetsProvider, useProjets, type ContexteProjets } from '@/stockage/ProjetsContext';
import { clientProjetsMemoire, type ClientProjetsMemoire } from '@/stockage/synchro/memoire';
import {
  INTERVALLE_RETOUR_MS,
  SynchroProvider,
  useSynchro,
  type ContexteSynchro,
} from '@/stockage/synchro/SynchroContext';
import type { ClientProjets } from '@/stockage/synchro/types';

const CAMILLE: Utilisateur = { id: 'camille', nom: 'Camille', email: 'c@example.org', image: null };

function stockageMemoire(): Storage {
  const donnees = new Map<string, string>();
  return {
    get length(): number {
      return donnees.size;
    },
    clear: () => {
      donnees.clear();
    },
    getItem: (cle: string) => donnees.get(cle) ?? null,
    key: (index: number) => [...donnees.keys()][index] ?? null,
    removeItem: (cle: string) => {
      donnees.delete(cle);
    },
    setItem: (cle: string, valeur: string) => {
      donnees.set(cle, valeur);
    },
  };
}

function distant(id: string): ProjetEnregistre {
  return {
    id,
    nom: `Projet ${id}`,
    statut: 'analyse',
    creeLe: '2026-09-01T10:00:00.000Z',
    modifieLe: '2026-09-01T10:00:00.000Z',
    projet: ProjetSchema.parse({ ...projetExemple, id }),
  };
}

interface Options {
  readonly compte?: ClientCompte;
  readonly projets?: ClientProjets;
}

interface Vue {
  readonly projets: ContexteProjets;
  readonly compte: ContexteCompte;
  readonly synchro: ContexteSynchro;
}

function monter(options: Options = {}): RenderHookResult<Vue, unknown> & { stockage: Storage } {
  const stockage = stockageMemoire();
  const compte = options.compte ?? clientMemoire({ utilisateur: CAMILLE });
  const client = options.projets ?? clientProjetsMemoire();
  const enveloppe = ({ children }: { children: ReactNode }): ReactNode => (
    <ProjetsProvider stockage={stockage}>
      <CompteProvider client={compte}>
        <SynchroProvider client={client} delaiMs={0}>
          {children}
        </SynchroProvider>
      </CompteProvider>
    </ProjetsProvider>
  );
  const rendu = renderHook(
    () => ({ projets: useProjets(), compte: useCompte(), synchro: useSynchro() }),
    { wrapper: enveloppe },
  );
  return { ...rendu, stockage };
}

/** Un compte en mémoire dont on peut suspendre les réponses. */
function clientRetenu(memoire: ClientProjetsMemoire): ClientProjets & {
  retenir: () => void;
  liberer: () => void;
} {
  let retenu = false;
  let attente = Promise.resolve();
  let ouvrir = (): void => undefined;
  return {
    retenir: () => {
      retenu = true;
      attente = new Promise((r) => {
        ouvrir = r;
      });
    },
    liberer: () => {
      retenu = false;
      ouvrir();
    },
    synchroniser: async (demande) => {
      if (retenu) await attente;
      return memoire.synchroniser(demande);
    },
  };
}

async function patienter(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SynchroProvider', () => {
  it('sans compte : aucune requête, projets sur l’appareil', async () => {
    const client = clientProjetsMemoire();
    const { result } = monter({ compte: clientMemoire(), projets: client });
    act(() => {
      result.current.projets.creer({ nom: 'Sans compte' });
    });
    await patienter();
    expect(client.demandes).toEqual([]);
    expect(result.current.synchro.statut).toBe('local');
  });

  it('pendant la lecture de la session : rien ne part', async () => {
    const client = clientProjetsMemoire();
    const enAttente: ClientCompte = {
      ...clientMemoire(),
      session: () => new Promise(() => undefined),
    };
    const { result } = monter({ compte: enAttente, projets: client });
    await patienter();
    expect(client.demandes).toEqual([]);
    expect(result.current.synchro.statut).toBe('local');
  });

  it('connexion à un compte vide : l’exemple de l’appareil y est versé', async () => {
    const client = clientProjetsMemoire();
    const { result, stockage } = monter({ projets: client });
    await waitFor(() => {
      expect(result.current.synchro.statut).toBe('a_jour');
    });
    expect(client.distants().map((p) => p.nom)).toEqual([NOM_EXEMPLE]);
    expect(lireJournal(stockage)).toMatchObject({ compte: 'camille', aEnvoyer: [] });
  });

  it('connexion à un compte qui a des projets : ils arrivent, l’exemple intact s’en va', async () => {
    const client = clientProjetsMemoire({ projets: [distant('lices')] });
    const { result } = monter({ projets: client });
    await waitFor(() => {
      expect(result.current.projets.projets.map((p) => p.nom)).toEqual(['Projet lices']);
    });
    await waitFor(() => {
      expect(result.current.synchro.statut).toBe('a_jour');
    });
    expect(client.distants()).toHaveLength(1);
  });

  it('une modification sur l’appareil est envoyée au compte', async () => {
    const client = clientProjetsMemoire();
    const { result } = monter({ projets: client });
    await waitFor(() => {
      expect(result.current.synchro.statut).toBe('a_jour');
    });
    act(() => {
      result.current.projets.creer({ nom: 'Nouveau' });
    });
    await waitFor(() => {
      expect(client.distants().map((p) => p.nom)).toContain('Nouveau');
    });
  });

  it('hors ligne puis déconnexion : les projets du compte partent, le projet pas envoyé reste', async () => {
    const client = clientProjetsMemoire();
    const { result, stockage } = monter({ projets: client });
    await waitFor(() => {
      expect(result.current.synchro.statut).toBe('a_jour');
    });
    client.echouer('reseau');
    act(() => {
      result.current.projets.creer({ nom: 'Hors ligne' });
    });
    await waitFor(() => {
      expect(result.current.synchro.statut).toBe('hors_ligne');
    });

    await act(async () => {
      await result.current.compte.deconnecter();
    });
    expect(result.current.synchro.statut).toBe('local');
    expect(result.current.projets.projets.map((p) => p.nom)).toEqual(['Hors ligne']);
    expect(lireJournal(stockage).compte).toBeNull();
  });

  it('suppression du compte : les projets restent sur l’appareil, sans compte', async () => {
    const { result, stockage } = monter();
    await waitFor(() => {
      expect(result.current.synchro.statut).toBe('a_jour');
    });
    await act(async () => {
      await result.current.compte.supprimer();
    });
    expect(result.current.projets.projets).toHaveLength(1);
    expect(lireJournal(stockage).compte).toBeNull();
  });

  it('session expirée côté serveur : statut « reconnexion »', async () => {
    const client = clientProjetsMemoire();
    client.echouer('non_connecte');
    const { result } = monter({ projets: client });
    await waitFor(() => {
      expect(result.current.synchro.statut).toBe('reconnexion');
    });
  });

  it('retour du réseau ; retour sur l’onglet visible après 30 s seulement', async () => {
    const client = clientProjetsMemoire();
    const { result } = monter({ projets: client });
    await waitFor(() => {
      expect(result.current.synchro.statut).toBe('a_jour');
    });
    const avant = client.demandes.length;

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => {
      expect(client.demandes).toHaveLength(avant + 1);
    });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await patienter();
    expect(client.demandes).toHaveLength(avant + 1);

    const plusTard = Date.now() + INTERVALLE_RETOUR_MS + 1_000;
    vi.spyOn(Date, 'now').mockReturnValue(plusTard);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await patienter();
    expect(client.demandes).toHaveLength(avant + 1);

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => {
      expect(client.demandes).toHaveLength(avant + 2);
    });
  });

  it('une demande pendant un cycle en relance un à la fin', async () => {
    const memoire = clientProjetsMemoire();
    const client = clientRetenu(memoire);
    const { result } = monter({ projets: client });
    await waitFor(() => {
      expect(result.current.synchro.statut).toBe('a_jour');
    });
    const avant = memoire.demandes.length;

    client.retenir();
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => {
      expect(result.current.synchro.statut).toBe('en_cours');
    });
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await act(async () => {
      client.liberer();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current.synchro.statut).toBe('a_jour');
    });
    expect(memoire.demandes).toHaveLength(avant + 2);
  });

  it('déconnexion pendant un cycle : sa fin ne change plus l’état affiché', async () => {
    const memoire = clientProjetsMemoire();
    const client = clientRetenu(memoire);
    const { result } = monter({ projets: client });
    await waitFor(() => {
      expect(result.current.synchro.statut).toBe('a_jour');
    });

    client.retenir();
    act(() => {
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('online'));
    });
    await act(async () => {
      await result.current.compte.deconnecter();
    });
    expect(result.current.synchro.statut).toBe('local');
    await act(async () => {
      client.liberer();
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(result.current.synchro.statut).toBe('local');
    expect(result.current.projets.projets).toEqual([]);
  });

  it('useSynchro refuse d’être utilisé hors du fournisseur', () => {
    expect(() => renderHook(() => useSynchro())).toThrow(/SynchroProvider/);
  });
});
