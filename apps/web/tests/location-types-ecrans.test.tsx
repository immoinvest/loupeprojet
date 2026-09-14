import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { SaisieProjet } from '@/annonces';
import { FormulaireProjet, valeursDepuisChamps } from '@/ecrans/FormulaireProjet';

async function remplirBien(utilisateur: ReturnType<typeof userEvent.setup>): Promise<void> {
  await utilisateur.type(screen.getByLabelText(/Prix affiché/), '120000');
  await utilisateur.type(screen.getByLabelText(/^Surface/), '60');
  await utilisateur.type(screen.getByLabelText(/Code postal/), '13002');
  await utilisateur.type(screen.getByLabelText(/^Ville/), 'Marseille');
  await utilisateur.type(screen.getByLabelText(/^Apport/), '10000');
  await utilisateur.type(screen.getByLabelText(/Vos revenus/), '2400');
}

describe('Vérifier — le type de location en tête de la carte « La location »', () => {
  it(
    'colocation : les chambres du bien pré-remplissent les chambres louées, la saisie part par chambre',
    { timeout: 30_000 },
    async () => {
      const onCreer = vi.fn<(saisie: SaisieProjet) => void>();
      const utilisateur = userEvent.setup();
      render(
        <FormulaireProjet
          initial={valeursDepuisChamps({ chambres: 3, mode: 'meuble' })}
          annonce={null}
          onCreer={onCreer}
        />,
      );
      expect(screen.getByRole('heading', { name: 'La location — Meublée' })).toBeInTheDocument();
      const titre = screen.getByRole('heading', { name: 'La location — Meublée' });
      expect(titre.parentElement).toHaveTextContent('annonce');
      expect(screen.getByRole('radio', { name: 'Meublée' })).toBeChecked();

      await utilisateur.click(screen.getByRole('radio', { name: 'Colocation' }));
      expect(screen.getByRole('heading', { name: 'La location — Colocation' })).toBeInTheDocument();
      expect(screen.queryByLabelText(/Loyer visé/)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/Chambres louées/)).toHaveValue('3');

      await remplirBien(utilisateur);
      await utilisateur.click(screen.getByRole('button', { name: /Créer le projet/ }));
      expect(
        screen.getByText('Indiquez le loyer d’une chambre, hors charges.'),
      ).toBeInTheDocument();
      expect(onCreer).not.toHaveBeenCalled();

      await utilisateur.type(screen.getByLabelText(/Loyer par chambre/), '450');
      await utilisateur.click(screen.getByRole('button', { name: /Créer le projet/ }));
      expect(onCreer).toHaveBeenCalledTimes(1);
      expect(onCreer.mock.calls[0]?.[0]).toMatchObject({
        mode: 'colocation',
        chambresLouees: 3,
        loyerChambre: 450,
        loyerHc: 1_350,
      });
    },
  );

  it(
    'courte durée : nuitée et nuits par mois, pas de bouton « Estimer le loyer »',
    { timeout: 30_000 },
    async () => {
      const onCreer = vi.fn<(saisie: SaisieProjet) => void>();
      const utilisateur = userEvent.setup();
      render(
        <FormulaireProjet initial={valeursDepuisChamps({})} annonce={null} onCreer={onCreer} />,
      );
      expect(screen.getByRole('button', { name: 'Estimer le loyer' })).toBeInTheDocument();

      await utilisateur.click(screen.getByRole('radio', { name: 'Courte durée' }));
      expect(screen.queryByRole('button', { name: 'Estimer le loyer' })).not.toBeInTheDocument();
      await remplirBien(utilisateur);
      await utilisateur.type(screen.getByLabelText(/Prix de la nuitée/), '70');
      await utilisateur.type(screen.getByLabelText(/Nuits louées par mois/), '16');
      await utilisateur.click(screen.getByRole('button', { name: /Créer le projet/ }));
      expect(onCreer.mock.calls[0]?.[0]).toMatchObject({
        mode: 'courte_duree',
        nuitee: 70,
        nuiteesParMois: 16,
        provenance: { mode: 'utilisateur' },
      });
    },
  );
});
