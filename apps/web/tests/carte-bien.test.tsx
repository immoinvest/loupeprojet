import { projetExemple, type ProjetEntree } from '@loupe/moteur';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { FournisseurProjet } from '@/coque/ProjetLayout';
import { CarteBien } from '@/ecrans/rapport/CarteBien';
import { creerProjet, type OptionsCreation } from '@/stockage/projets';

const PHOTOS = [
  'https://cdn.pap.fr/photos/pap/c9/13/c913-p1.jpg',
  'https://cdn.pap.fr/photos/pap/0d/ec/0dec-p1.jpg',
  'https://cdn.pap.fr/photos/pap/aa/bb/aabb-p1.jpg',
];
const URL_PAP = 'https://www.pap.fr/annonces/appartement-nice-06000-r463902045';

function afficher(options: OptionsCreation): ReturnType<typeof render> {
  const enregistre = creerProjet(options);
  return render(
    <MemoryRouter>
      <FournisseurProjet enregistre={enregistre}>
        <CarteBien />
      </FournisseurProjet>
    </MemoryRouter>,
  );
}

const source = (url: string): ProjetEntree => ({
  ...projetExemple,
  source: { portail: 'pap', id: '463902045', url },
});

describe('CarteBien', () => {
  it('photos, pastilles et lien vers l’annonce', () => {
    afficher({
      source: source(URL_PAP),
      annonce: {
        photos: PHOTOS,
        fiche: { chauffageCollectif: true, chauffageEnergie: 'gaz', cave: true },
        lueLe: '2026-09-14T12:00:00.000Z',
      },
    });
    expect(screen.getByRole('heading', { name: 'Le bien' })).toBeInTheDocument();
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(3);
    expect(images[0]).toHaveAttribute('src', PHOTOS[0]);
    expect(images[0]).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(images[0]).toHaveAttribute('alt', "Photo 1 sur 3 de l'annonce");
    expect(screen.getByText('Chauffage collectif · gaz')).toBeInTheDocument();
    expect(screen.getByText('Cave')).toBeInTheDocument();
    const lien = screen.getByRole('link', { name: "Voir l'annonce sur pap.fr" });
    expect(lien).toHaveAttribute('href', URL_PAP);
    expect(lien).toHaveAttribute('target', '_blank');
    expect(lien).toHaveAttribute('rel', 'noopener noreferrer');
    // Sur la ligne du titre, à droite, et non sur une ligne à lui sous les pastilles.
    expect(lien.parentElement).toContainElement(screen.getByRole('heading', { name: 'Le bien' }));
    expect(lien.closest('section')?.lastElementChild).not.toBe(lien);
  });

  it('une image qui ne se charge plus disparaît ; une image d’un autre site n’est jamais affichée', () => {
    afficher({
      annonce: {
        photos: [PHOTOS[0] ?? '', 'https://traceur.exemple.fr/pixel.gif', PHOTOS[1] ?? ''],
        fiche: {},
        lueLe: '2026-09-14T12:00:00.000Z',
      },
    });
    const images = screen.getAllByRole('img');
    expect(images.map((i) => i.getAttribute('src'))).toEqual([PHOTOS[0], PHOTOS[1]]);
    fireEvent.error(images[0] as HTMLImageElement);
    expect(screen.getAllByRole('img').map((i) => i.getAttribute('src'))).toEqual([PHOTOS[1]]);
    fireEvent.error(screen.getByRole('img'));
    // Plus de photo ni de caractéristique : plus de carte.
    expect(screen.queryByRole('heading', { name: 'Le bien' })).not.toBeInTheDocument();
  });

  it('pas de lien vers une annonce qui n’est pas en https sur un portail', () => {
    afficher({
      source: source('http://www.pap.fr/annonces/appartement-nice-06000-r463902045'),
      annonce: { fiche: { cave: true }, lueLe: '2026-09-14T12:00:00.000Z' },
    });
    expect(screen.getByText('Cave')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('rien pour un projet sans annonce, ou dont l’annonce ne dit rien', () => {
    const { container } = afficher({});
    expect(container).toBeEmptyDOMElement();
    const vide = afficher({ annonce: { fiche: {}, lueLe: '2026-09-14T12:00:00.000Z' } });
    expect(vide.container).toBeEmptyDOMElement();
  });
});
