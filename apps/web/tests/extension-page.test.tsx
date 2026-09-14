import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { AppEnMemoire } from '@/App';
import { MESSAGE_SITE_BLOQUANT, codeFavori } from '@/bookmarklet/favori';

afterEach(() => {
  vi.restoreAllMocks();
});

/** `userEvent.setup()` installe un presse-papiers dans jsdom ; on l'espionne ensuite. */
function preparer(): {
  utilisateur: ReturnType<typeof userEvent.setup>;
  writeText: MockInstance<(texte: string) => Promise<void>>;
} {
  const utilisateur = userEvent.setup();
  const writeText = vi.spyOn(navigator.clipboard, 'writeText');
  return { utilisateur, writeText };
}

describe('codeFavori', () => {
  it('est une URL javascript: courte qui charge capture.js depuis l’origine donnée', () => {
    const href = codeFavori('https://loupeprojet.pages.dev/');
    expect(href.startsWith('javascript:')).toBe(true);
    expect(href.length).toBeLessThan(600);
    const script = decodeURIComponent(href.slice('javascript:'.length));
    expect(script).toContain('"https://loupeprojet.pages.dev/capture.js"');
    expect(script).toContain(MESSAGE_SITE_BLOQUANT);
    expect(script).not.toContain('\n');
    expect(script).toMatch(/^\(function\(\)\{.*\}\)\(\);$/);
  });
});

describe('Page Extension navigateur', () => {
  it('pose le favori sur le lien à glisser et le copie au clic sur le bouton', async () => {
    const { utilisateur, writeText } = preparer();
    writeText.mockResolvedValue(undefined);
    render(<AppEnMemoire chemin="/extension" />);
    expect(
      await screen.findByRole('heading', { name: /Lisez une annonce en un clic/ }),
    ).toBeInTheDocument();
    const favori = screen.getByTitle(/Glissez-moi/);
    expect(favori.getAttribute('href')).toBe(codeFavori(window.location.origin));

    await utilisateur.click(screen.getByRole('button', { name: 'Copier le favori' }));
    expect(await screen.findByText(/Favori copié/)).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(codeFavori(window.location.origin));

    expect(screen.getByRole('link', { name: /guide du dépôt/ })).toHaveAttribute(
      'href',
      expect.stringContaining('github.com/immoinvest/loupeprojet') as string,
    );
    expect(screen.getByRole('link', { name: /collez le lien/ })).toHaveAttribute(
      'href',
      '/projets/nouveau',
    );
  });

  it('un clic sur le lien lui-même copie aussi, sans exécuter le favori', async () => {
    const { utilisateur, writeText } = preparer();
    writeText.mockResolvedValue(undefined);
    render(<AppEnMemoire chemin="/extension" />);
    await utilisateur.click(await screen.findByTitle(/Glissez-moi/));
    expect(await screen.findByText(/Favori copié/)).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it('montre l’adresse à copier à la main quand le presse-papiers refuse', async () => {
    const { utilisateur, writeText } = preparer();
    writeText.mockRejectedValue(new Error('refusé'));
    render(<AppEnMemoire chemin="/extension" />);
    await utilisateur.click(await screen.findByRole('button', { name: 'Copier le favori' }));
    expect(await screen.findByText(/Copie impossible ici/)).toBeInTheDocument();
    expect(screen.getByLabelText('Adresse du favori')).toHaveValue(
      codeFavori(window.location.origin),
    );
  });
});
