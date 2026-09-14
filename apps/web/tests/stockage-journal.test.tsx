import { JOURNAL_VIDE, type JournalSynchro } from '@loupe/projets';
import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { CLE_JOURNAL, ecrireJournal, lireJournal } from '@/stockage/journal';
import {
  ProjetsProvider,
  useProjets,
  useStockageProjets,
  type ContexteProjets,
  type StockageProjets,
} from '@/stockage/ProjetsContext';
import { creerProjet, ecrireProjets, lireProjets } from '@/stockage/projets';

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

const LIE: JournalSynchro = { ...JOURNAL_VIDE, compte: 'camille', synchronises: ['a'] };

function monter(
  stockage: Storage,
): RenderHookResult<{ projets: ContexteProjets; stockage: StockageProjets }, unknown> {
  const enveloppe = ({ children }: { children: ReactNode }): ReactNode => (
    <ProjetsProvider stockage={stockage}>{children}</ProjetsProvider>
  );
  return renderHook(() => ({ projets: useProjets(), stockage: useStockageProjets() }), {
    wrapper: enveloppe,
  });
}

describe('lireJournal', () => {
  it('absent, illisible ou invalide : un journal neuf ; sinon relit ce qui a été écrit', () => {
    const stockage = stockageMemoire();
    expect(lireJournal(stockage)).toBe(JOURNAL_VIDE);
    stockage.setItem(CLE_JOURNAL, '{cassé');
    expect(lireJournal(stockage)).toBe(JOURNAL_VIDE);
    stockage.setItem(CLE_JOURNAL, JSON.stringify({ compte: 3 }));
    expect(lireJournal(stockage)).toBe(JOURNAL_VIDE);
    ecrireJournal(stockage, LIE);
    expect(lireJournal(stockage)).toEqual(LIE);
  });
});

describe('journal tenu par ProjetsProvider', () => {
  it('sans compte : rien n’est noté, aucun journal écrit', () => {
    const stockage = stockageMemoire();
    const { result } = monter(stockage);
    act(() => {
      const cree = result.current.projets.creer({ nom: 'Sans compte' });
      result.current.projets.changerStatut(cree.id, 'offre');
      result.current.projets.supprimer(cree.id);
    });
    expect(stockage.getItem(CLE_JOURNAL)).toBeNull();
    expect(result.current.stockage.lire().journal).toBe(JOURNAL_VIDE);
    expect(result.current.stockage.versionLocale).toBe(3);
  });

  it('lié à un compte : création, statut, mise à jour et suppression sont notées', () => {
    const stockage = stockageMemoire();
    const a = creerProjet({ nom: 'A', genererId: () => 'a' });
    ecrireProjets(stockage, [a]);
    ecrireJournal(stockage, LIE);
    const { result } = monter(stockage);

    let b = '';
    act(() => {
      b = result.current.projets.creer({ nom: 'B' }).id;
    });
    expect(lireJournal(stockage).aEnvoyer).toEqual([b]);

    act(() => {
      result.current.projets.changerStatut('a', 'offre');
    });
    act(() => {
      result.current.projets.mettreAJour('a', a.projet, { visite: { faite: true, reponses: {} } });
    });
    expect(lireJournal(stockage).aEnvoyer).toEqual([b, 'a']);

    act(() => {
      result.current.projets.supprimer(b);
    });
    const journal = lireJournal(stockage);
    expect(journal.aEnvoyer).toEqual(['a']);
    expect(Object.keys(journal.aSupprimer)).toEqual([b]);
    expect(result.current.stockage.versionLocale).toBe(4);
  });

  it('un identifiant inconnu ne change rien et ne compte pas comme une modification', () => {
    const stockage = stockageMemoire();
    const a = creerProjet({ nom: 'A', genererId: () => 'a' });
    ecrireProjets(stockage, [a]);
    ecrireJournal(stockage, LIE);
    const { result } = monter(stockage);
    act(() => {
      result.current.projets.supprimer('inconnu');
      result.current.projets.changerStatut('inconnu', 'offre');
      result.current.projets.mettreAJour('inconnu', a.projet);
    });
    expect(result.current.stockage.versionLocale).toBe(0);
    expect(lireJournal(stockage)).toEqual(LIE);
  });

  it('deux actions du même clic voient chacune l’effet de la précédente', () => {
    const stockage = stockageMemoire();
    const { result } = monter(stockage);
    act(() => {
      const cree = result.current.projets.creer({ nom: 'Acheté' });
      result.current.projets.changerStatut(cree.id, 'achete');
    });
    expect(result.current.projets.projets.map((p) => [p.nom, p.statut])).toContainEqual([
      'Acheté',
      'achete',
    ]);
    expect(lireProjets(stockage)).toHaveLength(2);
  });

  it('transformer remplace projets et journal sans compter comme une modification', () => {
    const stockage = stockageMemoire();
    const { result } = monter(stockage);
    const recu = creerProjet({ nom: 'Du compte', genererId: () => 'recu' });
    act(() => {
      result.current.stockage.transformer(() => ({ projets: [recu], journal: LIE }));
    });
    expect(result.current.projets.projets).toEqual([recu]);
    expect(lireProjets(stockage)).toEqual([recu]);
    expect(lireJournal(stockage)).toEqual(LIE);
    expect(result.current.stockage.versionLocale).toBe(0);

    // Une transformation qui ne change rien n'écrit rien.
    stockage.removeItem(CLE_JOURNAL);
    act(() => {
      result.current.stockage.transformer((e) => e);
    });
    expect(stockage.getItem(CLE_JOURNAL)).toBeNull();
  });

  it('un appareil lié à un compte n’amorce pas l’exemple sur une liste vide', () => {
    const stockage = stockageMemoire();
    ecrireJournal(stockage, LIE);
    const { result } = monter(stockage);
    expect(result.current.projets.projets).toEqual([]);
  });

  it('useStockageProjets refuse d’être utilisé hors du fournisseur', () => {
    expect(() => renderHook(() => useStockageProjets())).toThrow(/ProjetsProvider/);
  });
});
