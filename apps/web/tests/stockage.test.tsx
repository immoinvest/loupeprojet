import { projetExemple } from '@loupe/moteur';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { ProjetsProvider, useProjets } from '@/stockage/ProjetsContext';
import {
  CLE_STOCKAGE,
  creerProjet,
  ecrireProjets,
  lireProjets,
  nomParDefaut,
} from '@/stockage/projets';

/** Stockage en mémoire, pour tester le fournisseur sans toucher localStorage. */
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

const stockage = (): Storage => window.localStorage;

describe('lireProjets', () => {
  it('rend une liste vide sans contenu, avec un JSON cassé ou un schéma invalide', () => {
    expect(lireProjets(stockage())).toEqual([]);
    stockage().setItem(CLE_STOCKAGE, '{pas du json');
    expect(lireProjets(stockage())).toEqual([]);
    stockage().setItem(CLE_STOCKAGE, JSON.stringify([{ id: 'x' }]));
    expect(lireProjets(stockage())).toEqual([]);
  });

  it('relit ce qui a été écrit', () => {
    const p = creerProjet({
      nom: 'Test',
      genererId: () => 'id-1',
      maintenant: () => '2026-09-13T00:00:00.000Z',
    });
    ecrireProjets(stockage(), [p]);
    const lus = lireProjets(stockage());
    expect(lus).toHaveLength(1);
    expect(lus[0]?.id).toBe('id-1');
    expect(lus[0]?.nom).toBe('Test');
    expect(lus[0]?.projet.hypotheses.achat.prix).toBe(155_000);
    expect(lus[0]?.projet.hypotheses.location.vacanceSemaines).toBe(3);
  });
});

describe('creerProjet', () => {
  it('génère un identifiant et des dates par défaut, statut « analyse »', () => {
    const p = creerProjet();
    expect(p.id.length).toBeGreaterThan(8);
    expect(p.projet.id).toBe(p.id);
    expect(p.statut).toBe('analyse');
    expect(p.creeLe).toBe(p.modifieLe);
    expect(new Date(p.creeLe).getFullYear()).toBeGreaterThanOrEqual(2026);
  });

  it('accepte une source, un nom et un statut', () => {
    const source = {
      ...projetExemple,
      bien: { ...projetExemple.bien, type: 'maison' as const, surface: 120 },
    };
    const p = creerProjet({ source, statut: 'ecarte' });
    expect(p.nom).toBe('Maison · 120 m² · dépt 13');
    expect(p.statut).toBe('ecarte');
    expect(p.projet.bien.type).toBe('maison');
  });

  it('nomParDefaut pour un appartement', () => {
    expect(nomParDefaut(projetExemple)).toBe('T3 · 65 m² · dépt 13');
  });

  it('reprend une visite et une adresse quand on les lui donne, rien sinon', () => {
    const sans = creerProjet();
    expect(sans).not.toHaveProperty('visite');
    expect(sans).not.toHaveProperty('adresse');
    const visite = { faite: true, date: '2026-09-14T10:00:00.000Z', reponses: {} };
    const avec = creerProjet({ visite });
    expect(avec.visite).toEqual(visite);
  });
});

describe('migration douce de la visite', () => {
  it('accepte un projet enregistré sans visite, avec visite, et refuse une visite invalide', () => {
    const p = creerProjet({ genererId: () => 'ancien' });
    stockage().setItem(CLE_STOCKAGE, JSON.stringify([p]));
    const [lu] = lireProjets(stockage());
    expect(lu?.id).toBe('ancien');
    expect(lu).not.toHaveProperty('visite');

    const visite = {
      faite: true,
      date: '2026-09-14',
      reponses: { A: { etat: 'probleme', note: 'n' } },
    };
    stockage().setItem(CLE_STOCKAGE, JSON.stringify([{ ...p, visite }]));
    expect(lireProjets(stockage())[0]?.visite).toEqual(visite);

    stockage().setItem(
      CLE_STOCKAGE,
      JSON.stringify([{ ...p, visite: { faite: 'oui', reponses: {} } }]),
    );
    expect(lireProjets(stockage())).toEqual([]);
  });
});

describe('ProjetsProvider / useProjets', () => {
  it('refuse d’être utilisé hors du fournisseur', () => {
    expect(() => renderHook(() => useProjets())).toThrow(/ProjetsProvider/);
  });

  it('amorce, crée, change le statut, supprime, dans un stockage fourni', () => {
    const stockage = stockageMemoire();
    const enveloppe = ({ children }: { children: ReactNode }): ReactNode => (
      <ProjetsProvider stockage={stockage}>{children}</ProjetsProvider>
    );
    const { result } = renderHook(() => useProjets(), { wrapper: enveloppe });
    expect(result.current.projets).toHaveLength(1);
    expect(lireProjets(stockage)).toHaveLength(1);
    expect(lireProjets(window.localStorage)).toHaveLength(0);

    let cree = '';
    act(() => {
      cree = result.current.creer({ nom: 'Second' }).id;
    });
    expect(result.current.projets[0]?.nom).toBe('Second');
    expect(result.current.trouver(cree)?.nom).toBe('Second');
    expect(result.current.trouver(undefined)).toBeUndefined();

    act(() => {
      result.current.changerStatut(cree, 'ecarte');
    });
    expect(result.current.trouver(cree)?.statut).toBe('ecarte');

    act(() => {
      result.current.supprimer(cree);
    });
    expect(result.current.projets).toHaveLength(1);
    expect(lireProjets(stockage)).toHaveLength(1);
  });

  it('mettreAJour valide par Zod, ne touche que le projet visé, et refuse une entrée invalide', () => {
    const stockage = stockageMemoire();
    const a = creerProjet({ nom: 'A' });
    const b = creerProjet({ nom: 'B' });
    ecrireProjets(stockage, [a, b]);
    const enveloppe = ({ children }: { children: ReactNode }): ReactNode => (
      <ProjetsProvider stockage={stockage}>{children}</ProjetsProvider>
    );
    const { result } = renderHook(() => useProjets(), { wrapper: enveloppe });

    let retour: ReturnType<typeof result.current.mettreAJour> | undefined;
    act(() => {
      retour = result.current.mettreAJour(b.id, {
        ...b.projet,
        hypotheses: {
          ...b.projet.hypotheses,
          location: { ...b.projet.hypotheses.location, loyerHc: 1_100 },
        },
      });
    });
    expect(retour).toEqual({ ok: true });
    expect(result.current.trouver(b.id)?.projet.hypotheses.location.loyerHc).toBe(1_100);
    expect(result.current.trouver(a.id)?.projet.hypotheses.location.loyerHc).toBe(980);
    expect(lireProjets(stockage)[1]?.projet.hypotheses.location.loyerHc).toBe(1_100);

    act(() => {
      retour = result.current.mettreAJour(a.id, {
        ...a.projet,
        hypotheses: {
          ...a.projet.hypotheses,
          pret: { ...a.projet.hypotheses.pret, dureeAnnees: 0 },
        },
      });
    });
    expect(retour?.ok).toBe(false);
    expect(retour?.ok === false && retour.erreurs['hypotheses.pret.dureeAnnees']).toBeTruthy();
    expect(result.current.trouver(a.id)?.projet.hypotheses.pret.dureeAnnees).toBe(25);
  });

  it('mettreAJour enregistre la visite passée en complément sans écraser l’adresse', () => {
    const stockage = stockageMemoire();
    const adresse = {
      libelle: '10 rue Paradis, Marseille',
      lat: 43.29,
      lon: 5.38,
      codeInsee: '13206',
      codeVoie: '7100',
      numero: 10,
    };
    const a = creerProjet({ nom: 'A', adresse });
    ecrireProjets(stockage, [a]);
    const enveloppe = ({ children }: { children: ReactNode }): ReactNode => (
      <ProjetsProvider stockage={stockage}>{children}</ProjetsProvider>
    );
    const { result } = renderHook(() => useProjets(), { wrapper: enveloppe });
    const visite = { faite: false, reponses: { DOC_TAXE_FONCIERE: { etat: 'ok' as const } } };
    act(() => {
      result.current.mettreAJour(a.id, a.projet, { visite });
    });
    expect(result.current.trouver(a.id)?.visite).toEqual(visite);
    expect(result.current.trouver(a.id)?.adresse).toEqual(adresse);
    expect(lireProjets(stockage)[0]?.visite).toEqual(visite);
    act(() => {
      result.current.mettreAJour(a.id, a.projet);
    });
    expect(result.current.trouver(a.id)?.visite).toEqual(visite);

    // Le projet déjà enregistré, passé tel quel : son identité est gardée (pas de recalcul).
    const charge = result.current.trouver(a.id)?.projet;
    act(() => {
      result.current.mettreAJour(a.id, charge ?? a.projet, {
        visite: { faite: true, reponses: {} },
      });
    });
    expect(result.current.trouver(a.id)?.projet).toBe(charge);
    expect(result.current.trouver(a.id)?.visite?.faite).toBe(true);
  });

  it('réutilise une liste déjà présente sans la réamorcer', () => {
    const stockage = stockageMemoire();
    ecrireProjets(stockage, [creerProjet({ nom: 'Existant' }), creerProjet({ nom: 'Autre' })]);
    const enveloppe = ({ children }: { children: ReactNode }): ReactNode => (
      <ProjetsProvider stockage={stockage}>{children}</ProjetsProvider>
    );
    const { result } = renderHook(() => useProjets(), { wrapper: enveloppe });
    expect(result.current.projets.map((p) => p.nom)).toEqual(['Existant', 'Autre']);
  });
});
