import { obtenirRegles } from '@loupe/moteur';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { AppEnMemoire } from '@/App';
import { appliquerTexte, fragmentSimulation, saisieDefaut, versSimulation } from '@/simulateur';

const regles = obtenirRegles('2026-09');

function fragment(): string {
  let s = saisieDefaut(regles);
  s = appliquerTexte(s, regles, 'a', 'nom', 'LCL');
  s = appliquerTexte(s, regles, 'a', 'differeTotalMois', '12');
  s = appliquerTexte(s, regles, 'b', 'nom', 'CIC');
  s = appliquerTexte(s, regles, 'projet', 'revenusMensuels', '2400');
  const simulation = versSimulation(s).simulation;
  if (simulation === null) throw new Error('simulation attendue');
  return fragmentSimulation(simulation);
}

describe('Simulation imprimée', () => {
  let impression: MockInstance<() => void>;

  beforeEach(() => {
    impression = vi.spyOn(window, 'print').mockImplementation(() => undefined);
  });
  afterEach(() => {
    impression.mockRestore();
  });

  it('rend la simulation du lien en mode document : hypothèses, résultats, comparaison, années', async () => {
    render(<AppEnMemoire chemin={`/simulateur-pret/imprimer${fragment()}`} />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Simulation de prêt' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Imprimé le/)).toBeInTheDocument();
    expect(screen.getByText(/2026-09 \(/)).toBeInTheDocument();
    expect(screen.getByText('LCL et CIC')).toBeInTheDocument();

    // Les hypothèses, formatées.
    const hypotheses = screen
      .getByRole('heading', { level: 2, name: 'Les hypothèses' })
      .closest('section');
    expect(hypotheses).not.toBeNull();
    expect(within(hypotheses!).getAllByText('Non, payés à la signature')).toHaveLength(2);
    expect(within(hypotheses!).getAllByText('12 mois')).toHaveLength(1);
    // Résultats, échéancier du différé, comparaison, explications visibles.
    expect(screen.getByRole('heading', { level: 2, name: 'LCL' })).toBeInTheDocument();
    expect(screen.getByText(/Mois 1 à 12 · différé total/)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Laquelle coûte le moins ?' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/70 % des loyers/)).toBeInTheDocument();
    // Les deux tableaux annuels, sans boutons ni mois.
    expect(screen.getByRole('table', { name: /Tableau d'amortissement, LCL/ })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /Tableau d'amortissement, CIC/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Voir les mois/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /CSV/ })).not.toBeInTheDocument();
    expect(screen.getByText(/pas un conseil en investissement/)).toBeInTheDocument();
    // Hors coque, et pas d'impression automatique sans l'état de navigation.
    expect(screen.queryByRole('navigation', { name: 'Mes projets' })).not.toBeInTheDocument();
    await new Promise((resoudre) => setTimeout(resoudre, 250));
    expect(impression).not.toHaveBeenCalled();
  });

  it('sans fragment, imprime les défauts ; ses boutons impriment et ramènent au simulateur', async () => {
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin="/simulateur-pret/imprimer" />);
    await screen.findByRole('heading', { level: 1, name: 'Simulation de prêt' });
    expect(screen.getByText('Offre A et Offre B')).toBeInTheDocument();

    await utilisateur.click(screen.getByRole('button', { name: /Imprimer ou enregistrer en PDF/ }));
    expect(impression).toHaveBeenCalledTimes(1);

    await utilisateur.click(screen.getByRole('link', { name: /Retour au simulateur/ }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Comparer deux offres de prêt' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Outils' })).toBeInTheDocument();
  });
});
