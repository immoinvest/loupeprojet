import { JOURNAL_VIDE } from '@loupe/projets';
import { render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { Bascule } from '@/coque/Bascule';
import { ProjetsProvider, useProjets } from '@/stockage/ProjetsContext';
import { ecrireJournal, lireJournal } from '@/stockage/journal';
import {
  creerProjet,
  ecrireProjets,
  lireProjets,
  NOM_PROJET_EXEMPLE,
  type ProjetEnregistre,
} from '@/stockage/projets';
import {
  CLE_TRANSFERT_FAIT,
  decoderTransfert,
  lienTransfert,
  lireFragmentTransfert,
} from '@/stockage/transfert';
import { TEXTES_TRANSFERT } from '@/textes/transfert';

const DIX = '2026-09-15T10:00:00.000Z';
const ONZE = '2026-09-15T11:00:00.000Z';
const ANCIENNE = 'https://loupeprojet.pages.dev';
const NOUVELLE = 'https://app.deklic.pro';

function projet(id: string, modifieLe = DIX, nom = `Projet ${id}`): ProjetEnregistre {
  return { ...creerProjet({ nom, genererId: () => id, maintenant: () => DIX }), modifieLe };
}

async function cheminTransfert(projets: readonly ProjetEnregistre[]): Promise<string> {
  return new URL(await lienTransfert(NOUVELLE, projets)).hash;
}

describe('Page /transfert', () => {
  it('importe les projets reçus, sans écraser un plus récent, et retire l’exemple posé à l’ouverture', async () => {
    ecrireProjets(window.localStorage, [projet('a', ONZE, 'A local')]);
    const hash = await cheminTransfert([
      projet('a', DIX, 'A ancien'),
      projet('b'),
      { ...projet('c'), nom: 'C' },
    ]);
    render(<AppEnMemoire chemin={`/transfert${hash}`} />);

    expect(await screen.findByText(TEXTES_TRANSFERT.bilan(2, 0))).toBeInTheDocument();
    expect(screen.getByText(TEXTES_TRANSFERT.gardes(1))).toBeInTheDocument();
    expect(lireProjets(window.localStorage).map((p) => p.nom)).toEqual([
      'Projet b',
      'C',
      'A local',
    ]);
    expect(screen.getByRole('link', { name: TEXTES_TRANSFERT.lienProjets })).toHaveAttribute(
      'href',
      '/projets',
    );
  });

  it('sur un appareil neuf, l’exemple amorcé laisse la place aux projets reçus', async () => {
    const hash = await cheminTransfert([projet('b')]);
    render(<AppEnMemoire chemin={`/transfert${hash}`} />);
    expect(await screen.findByText(TEXTES_TRANSFERT.bilan(1, 0))).toBeInTheDocument();
    expect(lireProjets(window.localStorage).map((p) => p.nom)).toEqual(['Projet b']);
  });

  it('rien à ajouter, projets illisibles comptés, fragment absent ou abîmé : chacun son message', async () => {
    const { unmount } = render(<AppEnMemoire chemin="/transfert" />);
    expect(await screen.findByText(TEXTES_TRANSFERT.raisons.vide)).toBeInTheDocument();
    unmount();

    const abime = render(<AppEnMemoire chemin="/transfert#d=%%%" />);
    expect(await screen.findByText(TEXTES_TRANSFERT.raisons.illisible)).toBeInTheDocument();
    abime.unmount();

    const existant = projet('a');
    ecrireProjets(window.localStorage, [existant]);
    const hash = await cheminTransfert([existant]);
    render(<AppEnMemoire chemin={`/transfert${hash}`} />);
    expect(await screen.findByText(TEXTES_TRANSFERT.bilan(0, 0))).toBeInTheDocument();
    expect(lireProjets(window.localStorage)).toEqual([existant]);
  });
});

describe('ProjetsContext.importer', () => {
  it('note au journal du compte les projets écrits et l’exemple retiré ; rien si rien ne change', () => {
    const s = window.localStorage;
    const exemple = projet('e', DIX, NOM_PROJET_EXEMPLE);
    ecrireProjets(s, [exemple]);
    ecrireJournal(s, { ...JOURNAL_VIDE, compte: 'u1' });
    const bilans: unknown[] = [];
    function Importeur(): null {
      const { importer } = useProjets();
      useEffect(() => {
        bilans.push(importer([projet('b')]), importer([projet('b')]));
      }, [importer]);
      return null;
    }
    render(
      <ProjetsProvider>
        <Importeur />
      </ProjetsProvider>,
    );
    expect(bilans.slice(0, 2)).toEqual([
      { ajoutes: 1, remplaces: 0, gardes: 0 },
      { ajoutes: 0, remplaces: 0, gardes: 1 },
    ]);
    const journal = lireJournal(s);
    expect(journal.aEnvoyer).toEqual(['b']);
    expect(Object.keys(journal.aSupprimer)).toEqual(['e']);
    expect(lireProjets(s).map((p) => p.id)).toEqual(['b']);
  });
});

describe('Bascule de l’ancienne adresse', () => {
  function fenetre(origin: string): { location: Location; replace: ReturnType<typeof vi.fn> } {
    const replace = vi.fn();
    return {
      replace,
      location: {
        origin,
        pathname: '/projets',
        search: '',
        hash: '#x',
        replace,
      } as unknown as Location,
    };
  }

  it('envoie une fois les projets vers la nouvelle adresse, puis redirige les visites suivantes', async () => {
    ecrireProjets(window.localStorage, [projet('a'), projet('e', DIX, NOM_PROJET_EXEMPLE)]);
    const f = fenetre(ANCIENNE);
    const { unmount } = render(
      <ProjetsProvider>
        <Bascule actif origineCible={NOUVELLE} fenetre={f} />
      </ProjetsProvider>,
    );
    await waitFor(() => {
      expect(f.replace).toHaveBeenCalledOnce();
    });
    const lien = String(f.replace.mock.calls[0]?.[0]);
    expect(lien.startsWith(`${NOUVELLE}/transfert#d=`)).toBe(true);
    const decodage = await decoderTransfert(lireFragmentTransfert(new URL(lien).hash) ?? '');
    expect(decodage.ok && decodage.projets.map((p) => p.id)).toEqual(['a']);
    expect(window.localStorage.getItem(CLE_TRANSFERT_FAIT)).not.toBeNull();
    // Rien n'est supprimé sur l'ancienne adresse.
    expect(lireProjets(window.localStorage)).toHaveLength(2);
    unmount();

    const g = fenetre(ANCIENNE);
    render(
      <ProjetsProvider>
        <Bascule actif origineCible={NOUVELLE} fenetre={g} />
      </ProjetsProvider>,
    );
    await waitFor(() => {
      expect(g.replace).toHaveBeenCalledWith(`${NOUVELLE}/projets#x`);
    });
  });

  it('ne fait rien sans drapeau ni ailleurs que sur l’adresse historique', async () => {
    const f = fenetre(ANCIENNE);
    const g = fenetre('https://feat-x.loupeprojet.pages.dev');
    render(
      <ProjetsProvider>
        <Bascule actif={false} origineCible={NOUVELLE} fenetre={f} />
        <Bascule actif origineCible={NOUVELLE} fenetre={g} />
        <Bascule actif={false} origineCible={NOUVELLE} />
      </ProjetsProvider>,
    );
    await new Promise((resoudre) => setTimeout(resoudre, 50));
    expect(f.replace).not.toHaveBeenCalled();
    expect(g.replace).not.toHaveBeenCalled();
  });
});
