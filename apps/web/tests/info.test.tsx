import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { ModeDocument } from '@/composants/document';
import { Info, decalageBulle } from '@/composants/info';
import { LienOnglet, TitreCarte } from '@/composants/ui';

const bouton = (): HTMLElement =>
  screen.getByRole('button', { name: "Explication : Est-ce que c'est cher ?" });

describe('Info', () => {
  it('ouvre et referme la bulle au clic, une seule bulle à la fois', async () => {
    const utilisateur = userEvent.setup();
    render(
      <>
        <Info sujet="Est-ce que c'est cher ?" texte="Comparé aux ventes réelles." />
        <Info sujet="Combien d'impôts ?" texte="Projeté année par année." />
      </>,
    );
    const bulle = screen.getByText('Comparé aux ventes réelles.');
    expect(bulle).toHaveAttribute('role', 'tooltip');
    expect(bulle).not.toBeVisible();
    expect(bouton()).toHaveAttribute('aria-expanded', 'false');
    expect(bouton()).toHaveAttribute('aria-describedby', bulle.id);
    expect(bouton()).toHaveAttribute('aria-controls', bulle.id);

    await utilisateur.click(bouton());
    expect(bulle).toBeVisible();
    expect(bouton()).toHaveAttribute('aria-expanded', 'true');

    // L'autre icône ferme la première et ouvre la sienne.
    await utilisateur.click(
      screen.getByRole('button', { name: "Explication : Combien d'impôts ?" }),
    );
    expect(bulle).not.toBeVisible();
    expect(screen.getByText('Projeté année par année.')).toBeVisible();

    await utilisateur.click(bouton());
    expect(bulle).toBeVisible();
    await utilisateur.click(bouton());
    expect(bulle).not.toBeVisible();
  });

  it('se ferme sur un clic ailleurs', async () => {
    const utilisateur = userEvent.setup();
    render(
      <div>
        <Info sujet="Est-ce que c'est cher ?" texte="Comparé aux ventes réelles." />
        <p>Un paragraphe ailleurs.</p>
      </div>,
    );
    await utilisateur.click(bouton());
    expect(screen.getByText('Comparé aux ventes réelles.')).toBeVisible();
    await utilisateur.click(screen.getByText('Un paragraphe ailleurs.'));
    expect(screen.getByText('Comparé aux ventes réelles.')).not.toBeVisible();
  });

  it('au clavier : le focus ouvre, Échap ferme sans perdre le focus, Tab ferme', async () => {
    const utilisateur = userEvent.setup();
    render(
      <div>
        <Info sujet="Est-ce que c'est cher ?" texte="Comparé aux ventes réelles." />
        <button type="button">Suivant</button>
      </div>,
    );
    const bulle = screen.getByText('Comparé aux ventes réelles.');
    await utilisateur.tab();
    expect(bouton()).toHaveFocus();
    expect(bulle).toBeVisible();

    await utilisateur.keyboard('{Escape}');
    expect(bulle).not.toBeVisible();
    expect(bouton()).toHaveFocus();

    // Entrée bascule la bulle, comme le clic.
    await utilisateur.keyboard('{Enter}');
    expect(bulle).toBeVisible();

    await utilisateur.tab();
    expect(screen.getByRole('button', { name: 'Suivant' })).toHaveFocus();
    expect(bulle).not.toBeVisible();
  });

  it('en mode document : le texte, sans bouton ni bulle', () => {
    render(
      <ModeDocument>
        <Info sujet="Est-ce que c'est cher ?" texte="Comparé aux ventes réelles." />
      </ModeDocument>,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.getByText('Comparé aux ventes réelles.')).toBeVisible();
  });

  it('la bulle tient dans l’écran : alignée sur le bouton, ramenée vers la gauche, marge de 16 px', () => {
    // Assez de place à droite : alignée sur le bord gauche du bouton.
    expect(decalageBulle(500, 1024)).toBe(0);
    // Bouton au bord droit : la bulle recule pour s'arrêter à 16 px du bord.
    expect(decalageBulle(900, 1024)).toBe(1024 - 16 - 320 - 900);
    // Bouton collé au bord gauche (jsdom : rectangles nuls) : jamais à moins de 16 px.
    expect(decalageBulle(0, 1024)).toBe(16);
    // Écran étroit (320 px) : la bulle fait 288 px et commence à 16 px.
    expect(decalageBulle(200, 320)).toBe(16 - 200);
  });
});

describe('TitreCarte', () => {
  it('garde le nom exact du titre : l’icône est à côté du h2, pas dedans', () => {
    render(
      <TitreCarte info={<Info sujet="Est-ce que c'est cher ?" texte="Explication." />}>
        Est-ce que c'est cher ?
      </TitreCarte>,
    );
    expect(
      screen.getByRole('heading', { level: 2, name: "Est-ce que c'est cher ?" }),
    ).toBeInTheDocument();
    expect(bouton()).toBeInTheDocument();
  });

  it('en mode document, l’explication s’empile sous le titre', () => {
    render(
      <ModeDocument>
        <TitreCarte info={<Info sujet="Est-ce que c'est cher ?" texte="Explication." />}>
          Est-ce que c'est cher ?
        </TitreCarte>
      </ModeDocument>,
    );
    const titre = screen.getByRole('heading', { level: 2 });
    const explication = screen.getByText('Explication.');
    expect(titre.parentElement).toBe(explication.parentElement);
    expect(
      titre.compareDocumentPosition(explication) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe('LienOnglet', () => {
  function rendre(document: boolean): void {
    const lien = <LienOnglet vers="fiscalite">Voir la fiscalité</LienOnglet>;
    render(
      <MemoryRouter initialEntries={['/projets/abc']}>
        <Routes>
          <Route path="projets/:id">
            <Route index element={document ? <ModeDocument>{lien}</ModeDocument> : lien} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  }

  it('mène au volet du projet courant', () => {
    rendre(false);
    expect(screen.getByRole('link', { name: 'Voir la fiscalité' })).toHaveAttribute(
      'href',
      '/projets/abc/fiscalite',
    );
  });

  it('n’existe pas dans un document', () => {
    rendre(true);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
