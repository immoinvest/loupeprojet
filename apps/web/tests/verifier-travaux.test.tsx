import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import { lireProjets } from '@/stockage/projets';

describe('Vérifier : travaux facultatifs', () => {
  it('« + Ajouter des travaux » révèle le champ ; le retirer remet les travaux à zéro', async () => {
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin="/projets/nouveau" />);
    await screen.findByRole('heading', { name: /Colle le lien/ });
    await utilisateur.click(screen.getByRole('button', { name: /je saisis à la main/ }));

    expect(screen.queryByLabelText(/Travaux prévus/)).toBeNull();
    const ajouter = screen.getByRole('button', { name: '+ Ajouter des travaux' });
    expect(ajouter).toHaveAttribute('aria-expanded', 'false');
    await utilisateur.click(ajouter);
    await utilisateur.type(screen.getByLabelText(/Travaux prévus/), '6000');
    expect(screen.getByLabelText(/Travaux prévus/)).toHaveValue('6000');

    await utilisateur.click(screen.getByRole('button', { name: '− Retirer les travaux' }));
    expect(screen.queryByLabelText(/Travaux prévus/)).toBeNull();
    await utilisateur.click(screen.getByRole('button', { name: '+ Ajouter des travaux' }));
    expect(screen.getByLabelText(/Travaux prévus/)).toHaveValue('');

    // Avec des travaux, le projet créé les porte.
    await utilisateur.type(screen.getByLabelText(/Travaux prévus/), '6000');
    await utilisateur.type(screen.getByLabelText(/Prix affiché/), '120000');
    await utilisateur.type(screen.getByLabelText(/Surface/), '40');
    await utilisateur.type(screen.getByLabelText(/Code postal/), '69003');
    await utilisateur.type(screen.getByLabelText(/^Ville/), 'Lyon');
    await utilisateur.type(screen.getByLabelText(/Loyer visé/), '700');
    await utilisateur.type(screen.getByLabelText(/^Apport/), '10000');
    await utilisateur.type(screen.getByLabelText(/Vos revenus/), '2400');
    await utilisateur.click(screen.getByRole('button', { name: /Créer le projet/ }));
    await screen.findByRole('heading', { name: /Prix sans repère de marché/ }, { timeout: 10_000 });
    const cree = lireProjets(window.localStorage).find((p) => p.nom === '40 m² · Lyon');
    expect(cree?.projet.hypotheses.achat.travaux).toBe(6_000);
    expect(cree?.projet.hypotheses.achat.negociationTaux).toBe(0);
  });
});
