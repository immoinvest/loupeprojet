import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';

describe('Page Méthode', () => {
  it('liste chaque module avec ses formules, ses constantes sourcées et les drapeaux', async () => {
    render(<AppEnMemoire chemin="/methode" />);
    expect(
      await screen.findByRole('heading', { name: "Comment c'est calculé" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Règles du 14 sept\. 2026 \(version 2026-09\)/)).toBeInTheDocument();

    const sommaire = screen.getByRole('navigation', { name: 'Sommaire' });
    expect(within(sommaire).getAllByRole('link')).toHaveLength(15);
    expect(within(sommaire).getByRole('link', { name: 'Le crédit' })).toHaveAttribute(
      'href',
      '#credit',
    );

    expect(screen.getByRole('heading', { name: "Les frais d'acquisition" })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Meublé au réel (LMNP)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Le verdict : cinq feux' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Les valeurs par défaut' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ce que le moteur simplifie' })).toBeInTheDocument();
    // Le libellé exact (la liste des simplifications contient une phrase plus longue).
    expect(screen.getByText('Surtaxe sur les plus-values élevées')).toBeInTheDocument();
    expect(screen.getByText('CGI art. 1594 D', { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText('à confirmer')).toHaveLength(18);
    expect(screen.getByText(/18 valeurs attendent une source officielle/)).toBeInTheDocument();
    expect(screen.getByText(/Frais d’acquisition passés en charge/)).toBeInTheDocument();
    expect(screen.getAllByRole('table').length).toBeGreaterThanOrEqual(10);
  });
});
