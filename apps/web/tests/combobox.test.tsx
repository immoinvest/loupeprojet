import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ModeDocument } from '@/composants/document';
import { ChampCommune, PHRASES_COMMUNE } from '@/composants/saisie/ChampCommune';
import { Combobox } from '@/composants/saisie/Combobox';
import { idsDescription, indexActifApres } from '@/composants/saisie/liste';
import { ClientWorkerProvider } from '@/coque/ClientWorker';
import { clientHorsLigne, type ClientWorker } from '@/enrichissement/client';
import type { Commune } from '@/enrichissement/contrat';
import type { SaisieCommune } from '@/enrichissement/communes';

const FRUITS = ['abricot', 'abricotier', 'ananas', 'banane'];

function Fruits({
  chercher,
  onChoix = () => undefined,
  choixAutomatique,
}: {
  chercher: (texte: string, signal: AbortSignal) => Promise<readonly string[]>;
  onChoix?: (fruit: string) => void;
  choixAutomatique?: (options: readonly string[], texte: string) => string | null;
}): JSX.Element {
  const [texte, setTexte] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <label htmlFor="fruit">Fruit</label>
      <Combobox<string>
        id="fruit"
        texte={texte}
        onTexte={setTexte}
        chercher={chercher}
        delaiMs={10}
        cleOption={(f) => f}
        libelleOption={(f) => f}
        detailOption={(f) => (f.length > 7 ? 'long' : undefined)}
        onChoix={(f) => {
          setTexte(f);
          onChoix(f);
        }}
        {...(choixAutomatique === undefined ? {} : { choixAutomatique })}
      />
    </form>
  );
}

const depuisListe = (texte: string): Promise<readonly string[]> =>
  Promise.resolve(FRUITS.filter((f) => f.startsWith(texte)));

describe('liste : logique', () => {
  it('Flèche bas et haut bouclent ; autres touches ignorées', () => {
    expect(indexActifApres('ArrowDown', -1, 3)).toBe(0);
    expect(indexActifApres('ArrowDown', 2, 3)).toBe(0);
    expect(indexActifApres('ArrowUp', -1, 3)).toBe(2);
    expect(indexActifApres('ArrowUp', 1, 3)).toBe(0);
    expect(indexActifApres('ArrowUp', 0, 3)).toBe(2);
    expect(indexActifApres('ArrowDown', -1, 0)).toBe(-1);
    expect(indexActifApres('Enter', 0, 3)).toBeNull();
  });

  it('réunit les ids de description présents', () => {
    expect(idsDescription('a', undefined, '', 'b')).toBe('a b');
    expect(idsDescription(undefined)).toBeUndefined();
  });
});

describe('Combobox', () => {
  it('propose après la frappe, Flèche bas puis Entrée choisit sans envoyer le formulaire', async () => {
    const u = userEvent.setup();
    const choix = vi.fn();
    render(<Fruits chercher={depuisListe} onChoix={choix} />);
    const saisie = screen.getByRole('combobox', { name: 'Fruit' });
    await u.type(saisie, 'ab');
    const liste = await screen.findByRole('listbox');
    expect(saisie).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent('2 suggestions');
    expect(screen.getByText('long')).toBeInTheDocument();
    await u.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('option', { name: /abricotier/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(saisie.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: /abricotier/ }).id,
    );
    await u.keyboard('{Enter}');
    expect(choix).toHaveBeenCalledWith('abricotier');
    expect(saisie).toHaveValue('abricotier');
    expect(liste).not.toBeVisible();
    expect(saisie).toHaveAttribute('aria-expanded', 'false');
  });

  it('un clic choisit ; Échap ferme ; Tab ferme ; aucun résultat annoncé', async () => {
    const u = userEvent.setup();
    const choix = vi.fn();
    render(<Fruits chercher={depuisListe} onChoix={choix} />);
    const saisie = screen.getByRole('combobox', { name: 'Fruit' });
    await u.type(saisie, 'an');
    await u.click(await screen.findByRole('option', { name: 'ananas' }));
    expect(choix).toHaveBeenCalledWith('ananas');

    await u.clear(saisie);
    await u.type(saisie, 'ba');
    await screen.findByRole('option', { name: 'banane' });
    await u.keyboard('{Escape}');
    expect(saisie).toHaveAttribute('aria-expanded', 'false');
    await u.keyboard('{ArrowDown}');
    expect(saisie).toHaveAttribute('aria-expanded', 'true');
    await u.keyboard('{Tab}');
    expect(saisie).toHaveAttribute('aria-expanded', 'false');

    await u.click(saisie);
    await u.type(saisie, 'zz');
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Aucun résultat');
    });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    // Un caractère : pas de recherche.
    await u.clear(saisie);
    await u.type(saisie, 'a');
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('annule la recherche dépassée et ignore sa réponse tardive', async () => {
    const u = userEvent.setup();
    const attentes: { texte: string; signal: AbortSignal; repondre: (r: string[]) => void }[] = [];
    const chercher = (texte: string, signal: AbortSignal): Promise<readonly string[]> =>
      new Promise((resoudre) => {
        attentes.push({ texte, signal, repondre: resoudre });
      });
    render(<Fruits chercher={chercher} />);
    const saisie = screen.getByRole('combobox', { name: 'Fruit' });
    await u.type(saisie, 'ab');
    await waitFor(() => {
      expect(attentes).toHaveLength(1);
    });
    await u.type(saisie, 'r');
    await waitFor(() => {
      expect(attentes).toHaveLength(2);
    });
    expect(attentes[0]?.signal.aborted).toBe(true);
    attentes[0]?.repondre(['périmé']);
    attentes[1]?.repondre(['abricot']);
    expect(await screen.findByRole('option', { name: 'abricot' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'périmé' })).not.toBeInTheDocument();
  });

  it('une source en échec ferme la liste ; choix automatique ; démontage sans erreur', async () => {
    const u = userEvent.setup();
    const choix = vi.fn();
    const { unmount } = render(
      <Fruits
        chercher={(texte) =>
          texte === 'xx' ? Promise.reject(new Error('panne')) : depuisListe(texte)
        }
        onChoix={choix}
        choixAutomatique={(options) => (options.length === 1 ? (options[0] ?? null) : null)}
      />,
    );
    const saisie = screen.getByRole('combobox', { name: 'Fruit' });
    await u.type(saisie, 'xx');
    await new Promise((r) => setTimeout(r, 40));
    expect(saisie).toHaveAttribute('aria-expanded', 'false');
    await u.clear(saisie);
    await u.type(saisie, 'ban');
    await waitFor(() => {
      expect(choix).toHaveBeenCalledWith('banane');
    });
    await u.clear(saisie);
    await u.type(saisie, 'ab');
    unmount();
  });

  it('une source en échec après une frappe plus récente est ignorée', async () => {
    const u = userEvent.setup();
    const rejets: ((e: Error) => void)[] = [];
    render(
      <Fruits
        chercher={(texte) =>
          texte === 'ab'
            ? new Promise((_, rejeter) => {
                rejets.push(rejeter);
              })
            : depuisListe(texte)
        }
      />,
    );
    const saisie = screen.getByRole('combobox', { name: 'Fruit' });
    await u.type(saisie, 'ab');
    await waitFor(() => {
      expect(rejets).toHaveLength(1);
    });
    await u.type(saisie, 'r');
    rejets[0]?.(new Error('trop tard'));
    expect(await screen.findByRole('option', { name: 'abricot' })).toBeInTheDocument();
  });
});

const MARSEILLE: Commune = { nom: 'Marseille', codeInsee: '13055', codesPostaux: ['13005'] };
const AIN: Commune[] = [
  { nom: 'Ars-sur-Formans', codeInsee: '01021', codesPostaux: ['01480'] },
  { nom: 'Fareins', codeInsee: '01157', codesPostaux: ['01480'] },
];

function Commune({ client }: { client: ClientWorker }): JSX.Element {
  const [saisie, setSaisie] = useState<SaisieCommune>({ codePostal: '', ville: '' });
  return (
    <ClientWorkerProvider client={client}>
      <label htmlFor="commune">Commune</label>
      <ChampCommune
        id="commune"
        codePostal={saisie.codePostal}
        ville={saisie.ville}
        onChange={setSaisie}
        decritPar="aide"
      />
      <output data-testid="saisie">{`${saisie.codePostal}|${saisie.ville}`}</output>
    </ClientWorkerProvider>
  );
}

describe('ChampCommune', () => {
  const client = (
    reponse: (r: Parameters<ClientWorker['communes']>[0]) => readonly Commune[],
  ): ClientWorker => ({
    ...clientHorsLigne,
    communes: (recherche) => Promise.resolve({ ok: true, valeur: reponse(recherche) }),
  });

  it('cinq chiffres d’une seule commune : la ville se remplit seule', async () => {
    const u = userEvent.setup();
    render(<Commune client={client(() => [MARSEILLE])} />);
    await u.type(screen.getByRole('combobox', { name: 'Commune' }), '13005');
    await waitFor(() => {
      expect(screen.getByTestId('saisie')).toHaveTextContent('13005|Marseille');
    });
    expect(screen.getByRole('combobox')).toHaveValue('13005 Marseille');
  });

  it('plusieurs communes : une liste, un clic ; par nom : codes postaux en détail', async () => {
    const u = userEvent.setup();
    render(<Commune client={client((r) => ('codePostal' in r ? AIN : [MARSEILLE]))} />);
    const saisie = screen.getByRole('combobox', { name: 'Commune' });
    await u.type(saisie, '01480');
    await u.click(await screen.findByRole('option', { name: /Fareins/ }));
    expect(screen.getByTestId('saisie')).toHaveTextContent('01480|Fareins');
    expect(saisie).toHaveValue('01480 Fareins');

    await u.clear(saisie);
    await u.type(saisie, 'Mars');
    expect(await screen.findByRole('option', { name: /Marseille\s*13005/ })).toBeInTheDocument();
    expect(saisie).toHaveAttribute('aria-describedby', 'aide');
  });

  it('Worker indisponible : une phrase explique la saisie libre, qui suffit', async () => {
    const u = userEvent.setup();
    render(<Commune client={clientHorsLigne} />);
    const saisie = screen.getByRole('combobox', { name: 'Commune' });
    await u.type(saisie, '69003');
    expect(await screen.findByText(PHRASES_COMMUNE.indisponible)).toBeInTheDocument();
    await u.type(saisie, ' Lyon');
    expect(screen.getByTestId('saisie')).toHaveTextContent('69003|Lyon');
    // Deux lettres ne suffisent pas à relancer une recherche réussie hors ligne : la phrase reste.
    expect(saisie.getAttribute('aria-describedby')).toMatch(/^aide /);
  });

  it('en document : le texte de la commune', () => {
    render(
      <ModeDocument>
        <ChampCommune id="c" codePostal="69003" ville="Lyon" onChange={() => undefined} />
      </ModeDocument>,
    );
    expect(screen.getByText('69003 Lyon')).toBeInTheDocument();
  });
});
