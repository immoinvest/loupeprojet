import { projetExemple, type ProjetEntree } from '@loupe/moteur';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import { creerProjet, ecrireProjets, type ProjetEnregistre } from '@/stockage/projets';

function projet(
  nom: string,
  hypotheses: Partial<ProjetEntree['hypotheses']> = {},
  statut: ProjetEnregistre['statut'] = 'analyse',
): ProjetEnregistre {
  return creerProjet({
    nom,
    statut,
    genererId: () => nom.toLowerCase().replace(/\W+/g, '-'),
    source: { ...projetExemple, hypotheses: { ...projetExemple.hypotheses, ...hypotheses } },
  });
}

/** Noms des projets dans l'ordre des colonnes. */
function colonnes(): string[] {
  const entetes = within(screen.getByRole('table')).getAllByRole('columnheader');
  return entetes.slice(1).map((e) => within(e).getByRole('link').textContent);
}

describe('Comparer', () => {
  it('avec un seul projet, invite à en créer un autre', async () => {
    ecrireProjets(window.localStorage, [projet('Seul')]);
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin="/comparer" />);
    await screen.findByRole('heading', { name: 'Comparer' });
    expect(screen.getByText(/au moins deux projets pour comparer/)).toBeInTheDocument();
    await utilisateur.click(screen.getAllByRole('button', { name: 'Nouveau projet' }).at(-1)!);
    expect(await screen.findByRole('heading', { name: /Colle le lien/ })).toBeInTheDocument();
  });

  it('compare les projets non écartés, trie par ligne et mène à chaque projet', async () => {
    ecrireProjets(window.localStorage, [
      projet('Marseille'),
      projet('Lyon rentable', {
        location: { mode: 'meuble', loyerHc: 1_500, vacanceSemaines: 0 },
      }),
      projet(
        'Écarté cher',
        { achat: { ...projetExemple.hypotheses.achat, prix: 220_000 } },
        'ecarte',
      ),
    ]);
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin="/comparer" />);
    await screen.findByRole('heading', { name: 'Comparer' });

    // Les deux projets actifs sont cochés d'office, pas l'écarté.
    expect(screen.getByRole('checkbox', { name: /Marseille/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Lyon rentable/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Écarté cher/ })).not.toBeChecked();
    expect(colonnes()).toEqual(['Marseille', 'Lyon rentable']);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(16);
    expect(within(table).getByRole('link', { name: 'Marseille' })).toHaveAttribute(
      'href',
      '/projets/marseille',
    );
    expect(screen.getAllByText('Meublé au réel · 10 ans')).toHaveLength(2);

    // Tri par cash-flow : le meilleur d'abord, puis l'inverse.
    await utilisateur.click(screen.getByRole('button', { name: 'Cash-flow mensuel' }));
    expect(colonnes()).toEqual(['Lyon rentable', 'Marseille']);
    expect(screen.getByRole('rowheader', { name: /Cash-flow mensuel/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    await utilisateur.click(screen.getByRole('button', { name: /Cash-flow mensuel/ }));
    expect(colonnes()).toEqual(['Marseille', 'Lyon rentable']);
    expect(screen.getByRole('rowheader', { name: /Cash-flow mensuel/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    // L'effort se trie dans l'autre sens (plus bas = mieux).
    await utilisateur.click(screen.getByRole('button', { name: 'Effort bancaire' }));
    expect(screen.getByRole('rowheader', { name: /Effort bancaire/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    // Ajouter l'écarté, puis retirer deux projets : le tableau attend au moins deux colonnes.
    await utilisateur.click(screen.getByRole('checkbox', { name: /Écarté cher/ }));
    expect(colonnes()).toHaveLength(3);
    await utilisateur.click(screen.getByRole('checkbox', { name: /Marseille/ }));
    await utilisateur.click(screen.getByRole('checkbox', { name: /Lyon rentable/ }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Choisissez au moins deux projets.')).toBeInTheDocument();
  });

  it('limite la sélection à cinq projets', async () => {
    ecrireProjets(
      window.localStorage,
      ['A', 'B', 'C', 'D', 'E', 'F'].map((nom) => projet(nom)),
    );
    render(<AppEnMemoire chemin="/comparer" />);
    await screen.findByRole('heading', { name: 'Comparer' });
    expect(colonnes()).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(screen.getByRole('checkbox', { name: /^F/ })).toBeDisabled();
  });
});
