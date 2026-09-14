import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { creerSuiviInstallation, type FenetreInstallation } from '@/application';
import { TEXTES_INSTALLATION } from '@/textes/application';

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

describe('Installer l’application', () => {
  it('le bouton n’apparaît que si le navigateur propose l’installation, et disparaît après', async () => {
    const utilisateur = userEvent.setup();
    const { fenetre, proposer } = navigateurQuiPropose();
    render(<AppEnMemoire chemin="/projets" installation={creerSuiviInstallation(fenetre)} />);
    await screen.findByRole('heading', { level: 1, name: 'Mes projets' });
    expect(screen.queryByRole('button', { name: TEXTES_INSTALLATION.bouton })).toBeNull();

    act(() => {
      proposer();
    });
    await utilisateur.click(screen.getByRole('button', { name: TEXTES_INSTALLATION.bouton }));
    expect(await screen.findByText(/Gratuit · 1 projet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TEXTES_INSTALLATION.bouton })).toBeNull();
  });

  it('sans suivi fourni, aucune proposition', async () => {
    render(<AppEnMemoire chemin="/projets" />);
    await screen.findByRole('heading', { level: 1, name: 'Mes projets' });
    expect(screen.queryByRole('button', { name: TEXTES_INSTALLATION.bouton })).toBeNull();
  });
});
