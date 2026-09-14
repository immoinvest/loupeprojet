import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';

/** Nom du projet créé au premier lancement (voir `ProjetsProvider`). */
const NOM_EXEMPLE = 'T3 · 65 m² · Marseille 5e';

function contenu(): HTMLElement {
  const element = document.querySelector('main');
  if (element === null) throw new Error('contenu principal absent');
  return element;
}

function barreLaterale(): HTMLElement {
  const element = document.getElementById('navigation-principale');
  if (element === null) throw new Error('navigation principale absente');
  return element;
}

async function ouvrirMesProjets(): Promise<ReturnType<typeof userEvent.setup>> {
  const utilisateur = userEvent.setup();
  render(<AppEnMemoire chemin="/projets" />);
  await screen.findByRole('heading', { level: 1, name: 'Mes projets' });
  return utilisateur;
}

describe('Coque fixe : seul le contenu défile', () => {
  it('la coque tient dans la fenêtre et le contenu est le seul conteneur qui défile', async () => {
    await ouvrirMesProjets();
    const racine = contenu().parentElement;
    expect(racine).not.toBeNull();
    expect(racine).toHaveClass('h-dvh', 'overflow-hidden');
    expect(contenu()).toHaveClass('overflow-y-auto', 'min-h-0');
    // À l'impression, la page redevient un document d'une seule pièce.
    expect(racine).toHaveClass('print:h-auto', 'print:overflow-visible');
    expect(contenu()).toHaveClass('print:overflow-visible');
  });

  it('changer de volet remet le contenu en haut', async () => {
    const utilisateur = await ouvrirMesProjets();
    await utilisateur.click(within(contenu()).getByRole('link', { name: NOM_EXEMPLE }));
    await screen.findByRole('heading', { level: 1, name: /Le prix est bon\./ });

    contenu().scrollTop = 480;
    const volets = screen.getByRole('navigation', { name: 'Volets du rapport' });
    await utilisateur.click(within(volets).getByRole('link', { name: 'Hypothèses' }));
    await screen.findByRole('heading', { level: 1, name: 'Vos hypothèses' });
    expect(contenu().scrollTop).toBe(0);

    // Une navigation vers le chemin déjà affiché (même volet) ne bouge pas le contenu.
    contenu().scrollTop = 120;
    await utilisateur.click(within(volets).getByRole('link', { name: 'Hypothèses' }));
    expect(contenu().scrollTop).toBe(120);
  });

  it('le menu : la liste des projets défile dans sa zone, le logo, « Nouveau projet », l’aide et le profil restent en dehors', async () => {
    await ouvrirMesProjets();
    const barre = barreLaterale();
    expect(barre).toHaveClass('overflow-hidden');
    const zone = barre.querySelector<HTMLElement>('[data-zone="defilante"]');
    expect(zone).not.toBeNull();
    expect(zone).toHaveClass('overflow-y-auto', 'min-h-0', 'flex-1');

    const projets = within(barre).getByRole('navigation', { name: 'Mes projets' });
    expect(zone).toContainElement(projets);
    expect(within(projets).getByRole('link', { name: NOM_EXEMPLE })).toBeInTheDocument();
    expect(within(projets).getByRole('link', { name: 'Comparer' })).toBeInTheDocument();

    const horsZone = [
      within(barre).getByRole('button', { name: 'Nouveau projet' }),
      within(barre).getByRole('button', { name: 'Fermer le menu' }),
      within(barre).getByRole('navigation', { name: 'Aide' }),
      within(barre).getByText('Gratuit · 1 projet'),
    ];
    for (const element of horsZone) {
      expect(barre).toContainElement(element);
      expect(zone).not.toContainElement(element);
    }
  });
});
