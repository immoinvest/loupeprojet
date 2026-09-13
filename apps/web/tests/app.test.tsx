import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import { CLE_STOCKAGE, lireProjets } from '@/stockage/projets';

const n = (s: string | null): string => (s ?? '').replace(/\s/g, ' ');

async function ouvrirExemple(): Promise<string> {
  render(<AppEnMemoire chemin="/projets" />);
  await screen.findByRole('heading', { name: 'Mes projets' });
  const id = lireProjets(window.localStorage)[0]?.id ?? '';
  render(<AppEnMemoire chemin={`/projets/${id}`} />);
  await screen.findByRole('heading', { name: /Le prix est bon/ });
  return id;
}

describe('Mes projets', () => {
  it('amorce le stockage avec le projet d’exemple et redirige la racine vers /projets', async () => {
    render(<AppEnMemoire chemin="/" />);
    expect(await screen.findByRole('heading', { name: 'Mes projets' })).toBeInTheDocument();
    expect(screen.getAllByText('T3 · 65 m² · Marseille 5e').length).toBeGreaterThan(0);
    expect(lireProjets(window.localStorage)).toHaveLength(1);
    expect(window.localStorage.getItem(CLE_STOCKAGE)).not.toBeNull();
  });

  it('affiche les métriques du moteur et le statut', async () => {
    render(<AppEnMemoire chemin="/projets" />);
    await screen.findByRole('heading', { name: 'Mes projets' });
    expect(n(screen.getByText(/−210 €\/mois/).textContent)).toBe('−210 €/mois');
    expect(n(screen.getByText(/−22 %/).textContent)).toBe('−22 %');
    expect(screen.getByText('Visite prévue')).toBeInTheDocument();
  });

  it('crée un projet, le filtre et le supprime', async () => {
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin="/projets" />);
    await screen.findByRole('heading', { name: 'Mes projets' });

    // Deux boutons « Nouveau projet » : barre latérale et en-tête de page. On prend celui de la page.
    await utilisateur.click(screen.getAllByRole('button', { name: 'Nouveau projet' }).at(-1)!);
    expect(await screen.findByRole('heading', { name: /Le prix est bon/ })).toBeInTheDocument();
    expect(lireProjets(window.localStorage)).toHaveLength(2);

    await utilisateur.click(screen.getByRole('link', { name: 'Mes projets' }));
    await screen.findByRole('heading', { name: 'Mes projets' });
    // Le compteur apparaît dans l'en-tête de page et dans le profil de la barre latérale.
    expect(screen.getAllByText(/2 projets/).length).toBeGreaterThanOrEqual(1);

    await utilisateur.click(screen.getByRole('button', { name: 'Écartés' }));
    expect(screen.getByText('Aucun projet dans cette liste.')).toBeInTheDocument();
    await utilisateur.click(screen.getByRole('button', { name: 'Tous' }));

    await utilisateur.click(screen.getByRole('button', { name: /Supprimer T3 · 65 m² · dépt 13/ }));
    expect(lireProjets(window.localStorage)).toHaveLength(1);
  });
});

describe('Rapport', () => {
  it('affiche le verdict, les cinq feux et les cartes avec les chiffres du moteur', async () => {
    await ouvrirExemple();

    expect(
      screen.getByRole('heading', { name: 'Le prix est bon. Le loyer ne couvre pas tout.' }),
    ).toBeInTheDocument();
    const feux = screen.getAllByLabelText('Cinq feux').at(-1);
    expect(feux).toBeDefined();
    expect(within(feux!).getAllByText(/Prix|Rendement|Cash-flow|Effort|Risques/)).toHaveLength(5);

    expect(screen.getByRole('heading', { name: "Est-ce que c'est cher ?" })).toBeInTheDocument();
    // « Non. » deux fois : ce n'est pas cher, et ça ne s'autofinance pas (−210 €/mois).
    expect(screen.getAllByText('Non.')).toHaveLength(2);
    expect(n(screen.getByText(/1 203 €/).textContent)).toContain('1 203 €');
    expect(screen.getByText('Levier 1 · Négocier')).toBeInTheDocument();
    expect(n(screen.getByText(/119 663 €/).textContent)).toContain('119 663 €');
    expect(screen.getByText(/Meublé au réel : aucun impôt/)).toBeInTheDocument();
    expect(n(screen.getByText(/58 217 €/).textContent)).toContain('58 217 €');
  });

  it('les onglets non livrés affichent un état « bientôt », un id inconnu une page introuvable', async () => {
    await ouvrirExemple();
    const utilisateur = userEvent.setup();
    await utilisateur.click(screen.getByRole('link', { name: 'Fiscalité' }));
    expect(await screen.findByRole('heading', { name: 'Fiscalité' })).toBeInTheDocument();

    render(<AppEnMemoire chemin="/projets/inconnu" />);
    expect(await screen.findByRole('heading', { name: 'Projet introuvable' })).toBeInTheDocument();
  });

  it('change le statut depuis l’en-tête', async () => {
    await ouvrirExemple();
    const utilisateur = userEvent.setup();
    await utilisateur.selectOptions(screen.getByLabelText('Statut du projet'), 'offre');
    expect(lireProjets(window.localStorage)[0]?.statut).toBe('offre');
  });
});
