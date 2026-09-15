import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { detecterExtension } from '@/annonces/extension';
import { creerSuiviInstallation, type FenetreInstallation } from '@/application';
import { clientMemoire } from '@/compte/memoire';
import type { Utilisateur } from '@/compte/types';
import { TEXTES_APPAREILS as T, TEXTES_INSTALLATION } from '@/textes/application';

vi.mock('@/annonces/extension', () => ({
  detecterExtension: vi.fn(),
  lireParExtension: vi.fn(),
}));

const CAMILLE: Utilisateur = {
  id: 'u_1',
  nom: 'Camille Durand',
  email: 'camille@example.org',
  image: null,
};

/** Une fenêtre qui émet `beforeinstallprompt` à la demande. */
function navigateurQuiPropose(): { fenetre: FenetreInstallation; proposer: () => void } {
  const ecouteurs: ((evenement: Event) => void)[] = [];
  const fenetre: FenetreInstallation = {
    addEventListener: (type, ecouteur) => {
      if (type === 'beforeinstallprompt') ecouteurs.push(ecouteur);
    },
  };
  const proposer = (): void => {
    const evenement = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: vi.fn(() => Promise.resolve()),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    for (const ecouteur of ecouteurs) ecouteur(evenement);
  };
  return { fenetre, proposer };
}

function barreLaterale(): HTMLElement {
  return screen.getAllByRole('complementary').at(-1)!;
}

async function carte(): Promise<HTMLElement> {
  const titre = await screen.findByRole('heading', { level: 2, name: T.titre });
  const section = titre.closest('section');
  if (section === null) throw new Error('carte « Deklic sur vos appareils » introuvable');
  return section;
}

/** Le menu ne porte plus ni l'extension ni l'installation : elles sont dans Mon compte. */
function menuSansAppareils(): void {
  const barre = barreLaterale();
  expect(within(barre).queryByRole('link', { name: T.extension })).toBeNull();
  expect(within(barre).queryByRole('button', { name: TEXTES_INSTALLATION.bouton })).toBeNull();
  expect(within(barre).queryByRole('navigation', { name: 'Aide' })).toBeNull();
}

beforeEach(() => {
  vi.mocked(detecterExtension).mockReset().mockResolvedValue(false);
});

describe('Mon compte : Deklic sur vos appareils', () => {
  it('sans extension ni invite du navigateur : un lien vers chaque marche à suivre', async () => {
    render(<AppEnMemoire chemin="/compte" compte={clientMemoire({ utilisateur: CAMILLE })} />);
    const appareils = await carte();
    expect(within(appareils).getByRole('heading', { level: 3, name: T.extension })).toBeVisible();
    expect(within(appareils).getByRole('heading', { level: 3, name: T.application })).toBeVisible();
    expect(within(appareils).getByRole('link', { name: T.installerExtension })).toHaveAttribute(
      'href',
      '/extension',
    );
    expect(within(appareils).getByRole('link', { name: T.commentInstaller })).toHaveAttribute(
      'href',
      '/extension',
    );
    expect(within(appareils).queryByText(T.installee)).toBeNull();
    // La détection part dans un effet : sous charge, elle peut n'avoir pas encore eu lieu.
    await waitFor(() => {
      expect(detecterExtension).toHaveBeenCalledWith(window);
    });
    menuSansAppareils();
  });

  it('l’extension qui répond est dite installée', async () => {
    vi.mocked(detecterExtension).mockResolvedValue(true);
    render(<AppEnMemoire chemin="/compte" compte={clientMemoire({ utilisateur: CAMILLE })} />);
    const appareils = await carte();
    expect(await within(appareils).findByText(T.installee)).toBeInTheDocument();
    expect(within(appareils).queryByRole('link', { name: T.installerExtension })).toBeNull();
  });

  it('le bouton n’apparaît que si le navigateur propose l’installation, puis « installée »', async () => {
    const utilisateur = userEvent.setup();
    const { fenetre, proposer } = navigateurQuiPropose();
    render(
      <AppEnMemoire
        chemin="/compte"
        compte={clientMemoire({ utilisateur: CAMILLE })}
        installation={creerSuiviInstallation(fenetre)}
      />,
    );
    const appareils = await carte();
    expect(
      within(appareils).queryByRole('button', { name: TEXTES_INSTALLATION.bouton }),
    ).toBeNull();

    act(() => {
      proposer();
    });
    menuSansAppareils();
    // `findByRole` et non `getByRole` : les contextes de Gérer (Argent, bail, envois) rendent de
    // nouveau la page quand leurs données arrivent, et le bouton peut n'apparaître qu'au rendu suivant.
    await utilisateur.click(
      await within(appareils).findByRole('button', { name: TEXTES_INSTALLATION.bouton }),
    );
    expect(await within(appareils).findByText(T.installee)).toBeInTheDocument();
    expect(
      within(appareils).queryByRole('button', { name: TEXTES_INSTALLATION.bouton }),
    ).toBeNull();
    expect(within(appareils).queryByRole('link', { name: T.commentInstaller })).toBeNull();
  });

  it('sans compte, le menu ne propose rien non plus, même quand le navigateur le permet', async () => {
    const { fenetre, proposer } = navigateurQuiPropose();
    render(<AppEnMemoire chemin="/projets" installation={creerSuiviInstallation(fenetre)} />);
    await screen.findByRole('heading', { level: 1, name: 'Mes projets' });
    act(() => {
      proposer();
    });
    menuSansAppareils();
  });
});
