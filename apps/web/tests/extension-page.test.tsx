import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Page Extension navigateur', () => {
  it('propose le bouton-favori à glisser, avec le code servi par le site en URL javascript:', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, text: () => Promise.resolve('alert("Loupe %");') })),
    );
    render(<AppEnMemoire chemin="/extension" />);
    expect(
      await screen.findByRole('heading', { name: /Lisez une annonce en un clic/ }),
    ).toBeInTheDocument();
    const favori = await screen.findByTitle(/Glissez-moi/);
    await screen.findByText(/Un clic ici ne fait rien/);
    expect(favori.getAttribute('href')).toBe(
      `javascript:${encodeURIComponent('alert("Loupe %");')}`,
    );
    expect(screen.getByRole('link', { name: /guide du dépôt/ })).toHaveAttribute(
      'href',
      expect.stringContaining('github.com/immoinvest/loupeprojet') as string,
    );
    expect(screen.getByRole('link', { name: /collez le texte/ })).toHaveAttribute(
      'href',
      '/projets/nouveau',
    );
  });

  it('dit quand le bouton-favori n’est pas disponible', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') })),
    );
    render(<AppEnMemoire chemin="/extension" />);
    expect(await screen.findByText(/pas disponible sur cette version/)).toBeInTheDocument();
    expect(screen.getByTitle(/Glissez-moi/).getAttribute('href')).toBeNull();
  });

  it('reste calme si le réseau échoue', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('hors ligne'))),
    );
    render(<AppEnMemoire chemin="/extension" />);
    expect(await screen.findByText(/pas disponible sur cette version/)).toBeInTheDocument();
  });
});
