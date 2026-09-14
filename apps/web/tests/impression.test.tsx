import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { AppEnMemoire } from '@/App';
import { creerProjet, ecrireProjets } from '@/stockage/projets';

/** Un projet d'exemple enregistré avec un identifiant connu. */
function amorcer(): string {
  const p = creerProjet({
    nom: 'T3 · 65 m² · Marseille 5e',
    statut: 'visite',
    genererId: () => 'exemple',
  });
  ecrireProjets(window.localStorage, [p]);
  return p.id;
}

describe('Impression', () => {
  // jsdom déclare window.print sans l'implémenter : on l'espionne.
  let impression: MockInstance<() => void>;

  beforeEach(() => {
    impression = vi.spyOn(window, 'print').mockImplementation(() => undefined);
  });
  afterEach(() => {
    impression.mockRestore();
  });

  it('le bouton PDF ouvre le document complet et lance l’impression', async () => {
    const id = amorcer();
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin={`/projets/${id}`} />);
    await screen.findByRole('heading', { name: /Le prix est bon/ });

    await utilisateur.click(screen.getByRole('button', { name: 'PDF' }));
    expect(await screen.findByText(/dossier d'analyse locative/)).toBeInTheDocument();
    await waitFor(() => {
      expect(impression).toHaveBeenCalledTimes(1);
    });

    // Les cinq volets, dans l'ordre, avec un en-tête et un pied de page.
    expect(screen.getByRole('heading', { name: 'T3 · 65 m² · Marseille 5e' })).toBeInTheDocument();
    expect(screen.getByText(/Imprimé le/)).toBeInTheDocument();
    // « Règles fiscales 2026-09 (13 sept. 2026) » dans l'en-tête du document.
    expect(screen.getByText(/2026-09 \(/)).toBeInTheDocument();
    // Les cartes du Rapport reprennent ces questions en h2 : on vise les titres de volet (h1).
    expect(screen.getByRole('heading', { level: 1, name: /Le prix est bon/ })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: "Comment se finance l'achat ?" }),
    ).toBeInTheDocument();
    // Le prêt en lignes lisibles, sans champ ni lien vers le simulateur.
    expect(screen.queryByLabelText(/Durée du prêt/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Simuler un prêt' })).not.toBeInTheDocument();
    expect(screen.getByText('25 ans')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: /Combien d'impôts, selon le régime/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: /Qu'est-ce qu'il vous restera/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Préparer la visite' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/pas un conseil en investissement/)).toBeInTheDocument();
    expect(document.querySelectorAll('.document-volet')).toHaveLength(4);

    // Mode document : pas de boutons d'action, explications dépliées, horizons figés.
    expect(screen.queryByRole('button', { name: 'Retenir ce régime' })).not.toBeInTheDocument();
    expect(screen.getByText(/ventes signées chez le notaire/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dans 20 ans/ })).toBeDisabled();
    // La coque n'est pas là : ni barre latérale, ni onglets.
    expect(screen.queryByRole('navigation', { name: 'Mes projets' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Volets du rapport' })).not.toBeInTheDocument();
  });

  it('ouverte directement, la page n’imprime pas seule ; ses boutons impriment et ramènent au projet', async () => {
    const id = amorcer();
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin={`/projets/${id}/imprimer`} />);
    await screen.findByText(/dossier d'analyse locative/);
    await new Promise((resoudre) => setTimeout(resoudre, 250));
    expect(impression).not.toHaveBeenCalled();

    await utilisateur.click(screen.getByRole('button', { name: /Imprimer ou enregistrer en PDF/ }));
    expect(impression).toHaveBeenCalledTimes(1);

    await utilisateur.click(screen.getByRole('link', { name: /Retour au projet/ }));
    expect(
      await screen.findByRole('navigation', { name: 'Volets du rapport' }),
    ).toBeInTheDocument();
  });

  it('un identifiant inconnu donne « Projet introuvable »', async () => {
    render(<AppEnMemoire chemin="/projets/inconnu/imprimer" />);
    expect(await screen.findByRole('heading', { name: 'Projet introuvable' })).toBeInTheDocument();
    expect(impression).not.toHaveBeenCalled();
  });
});
