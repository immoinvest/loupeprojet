import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';

/** Le tiroir est la barre latérale ; l'élément `main` peut être inerte, on le lit directement. */
function tiroir(): HTMLElement {
  const element = document.getElementById('navigation-principale');
  if (element === null) throw new Error('navigation principale absente');
  return element;
}

function contenu(): HTMLElement {
  const element = document.querySelector('main');
  if (element === null) throw new Error('contenu principal absent');
  return element;
}

async function ouvrirMesProjets(): Promise<{
  utilisateur: ReturnType<typeof userEvent.setup>;
  bouton: HTMLElement;
}> {
  const utilisateur = userEvent.setup();
  render(<AppEnMemoire chemin="/projets" />);
  await screen.findByRole('heading', { level: 1, name: 'Mes projets' });
  return { utilisateur, bouton: screen.getByRole('button', { name: 'Ouvrir le menu' }) };
}

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('Menu des petits écrans', () => {
  it('ouvre le tiroir : focus dedans, page figée, contenu inerte ; Échap le ferme et rend le focus', async () => {
    const { utilisateur, bouton } = await ouvrirMesProjets();
    expect(bouton).toHaveAttribute('aria-expanded', 'false');
    expect(bouton).toHaveAttribute('aria-controls', 'navigation-principale');
    expect(tiroir()).toHaveAttribute('data-ouvert', 'false');

    await utilisateur.click(bouton);
    expect(bouton).toHaveAttribute('aria-expanded', 'true');
    expect(tiroir()).toHaveAttribute('data-ouvert', 'true');
    expect(contenu()).toHaveAttribute('inert');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(within(tiroir()).getByRole('button', { name: 'Fermer le menu' })).toHaveFocus();

    await utilisateur.keyboard('{Escape}');
    expect(bouton).toHaveAttribute('aria-expanded', 'false');
    expect(contenu()).not.toHaveAttribute('inert');
    expect(document.documentElement.style.overflow).toBe('');
    expect(bouton).toHaveFocus();
  });

  it('se ferme avec « Fermer le menu » ou en touchant le voile', async () => {
    const { utilisateur, bouton } = await ouvrirMesProjets();

    await utilisateur.click(bouton);
    await utilisateur.click(within(tiroir()).getByRole('button', { name: 'Fermer le menu' }));
    expect(bouton).toHaveAttribute('aria-expanded', 'false');
    expect(bouton).toHaveFocus();

    await utilisateur.click(bouton);
    const voile = document.querySelector('[data-voile]');
    expect(voile).not.toBeNull();
    await utilisateur.click(voile!);
    expect(bouton).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('[data-voile]')).toBeNull();
    // Échap tiroir fermé : sans effet.
    await utilisateur.keyboard('{Escape}');
    expect(bouton).toHaveAttribute('aria-expanded', 'false');
  });

  it('se referme quand on navigue, même vers la page affichée, et passe le focus au contenu', async () => {
    const { utilisateur, bouton } = await ouvrirMesProjets();

    await utilisateur.click(bouton);
    await utilisateur.click(within(tiroir()).getByRole('link', { name: 'Accueil' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bienvenue sur Deklic' }),
    ).toBeInTheDocument();
    expect(bouton).toHaveAttribute('aria-expanded', 'false');
    expect(contenu()).toHaveFocus();

    await utilisateur.click(bouton);
    await utilisateur.click(within(tiroir()).getByRole('link', { name: 'Accueil' }));
    expect(bouton).toHaveAttribute('aria-expanded', 'false');
    expect(contenu()).toHaveFocus();

    // Tiroir fermé (barre latérale d'ordinateur) : naviguer ne déplace pas le focus.
    const lienExtension = within(tiroir()).getByRole('link', { name: 'Extension navigateur' });
    await utilisateur.click(lienExtension);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Lisez une annonce en un clic.' }),
    ).toBeInTheDocument();
    expect(lienExtension).toHaveFocus();
  });

  it('se referme quand l’écran devient large, et ignore un écran resté étroit', async () => {
    let surChangement: (() => void) | undefined;
    const requete = {
      matches: false,
      addEventListener: (_type: string, ecouteur: () => void): void => {
        surChangement = ecouteur;
      },
      removeEventListener: (): void => undefined,
    };
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (): typeof requete => requete,
    });
    const { utilisateur, bouton } = await ouvrirMesProjets();

    await utilisateur.click(bouton);
    act(() => {
      surChangement?.();
    });
    expect(bouton).toHaveAttribute('aria-expanded', 'true');

    requete.matches = true;
    act(() => {
      surChangement?.();
    });
    expect(bouton).toHaveAttribute('aria-expanded', 'false');
    expect(contenu()).not.toHaveAttribute('inert');
  });
});
