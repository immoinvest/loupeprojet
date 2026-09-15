import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { SaisieProjet } from '@/annonces';
import { FormulaireProjet, valeursDepuisChamps } from '@/ecrans/FormulaireProjet';

import { LUS, ouvrirGroupe, saisirApport, saisirCommune } from './aides-verifier';

async function remplirBien(utilisateur: ReturnType<typeof userEvent.setup>): Promise<void> {
  await utilisateur.type(screen.getByLabelText(/Prix affiché/), '120000');
  await utilisateur.type(screen.getByLabelText(/^Surface/), '60');
  await saisirCommune(utilisateur, '13002 Marseille');
  await saisirApport(utilisateur, '10000');
}

describe('Vérifier — le type de location', () => {
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
      // Lu dans l'annonce : le type de location est replié avec le reste de ce qu'elle a donné.
      await ouvrirGroupe(utilisateur, LUS);
      const type = screen.getByRole('radiogroup', { name: 'Type de location' });
      expect(type.closest('div.flex-col')).toHaveTextContent('annonce');
      expect(screen.getByRole('radio', { name: 'Meublée' })).toBeChecked();

      await utilisateur.click(screen.getByRole('radio', { name: 'Colocation' }));
      expect(screen.queryByLabelText(/Loyer visé/)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/Chambres louées/)).toHaveValue('3');

      await remplirBien(utilisateur);
      const loyerChambre = screen.getByLabelText(/Loyer par chambre/);
      await utilisateur.type(loyerChambre, '450');
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
    'colocation : des chambres louées hors bornes sont refusées',
    { timeout: 30_000 },
    async () => {
      const onCreer = vi.fn<(saisie: SaisieProjet) => void>();
      const utilisateur = userEvent.setup();
      render(
        <FormulaireProjet initial={valeursDepuisChamps({})} annonce={null} onCreer={onCreer} />,
      );
      await utilisateur.click(screen.getByRole('radio', { name: 'Colocation' }));
      await remplirBien(utilisateur);
      await utilisateur.type(screen.getByLabelText(/Chambres louées/), '25');
      await utilisateur.click(screen.getByRole('button', { name: /Créer le projet/ }));
      expect(screen.getByText('Entre 1 et 20 chambres, ou rien.')).toBeInTheDocument();
      expect(onCreer).not.toHaveBeenCalled();
    },
  );

  it(
    'courte durée : nuitée et curseur des nuits par mois, pas de bouton « Estimer le loyer »',
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
      const nuits = screen.getByRole('slider', { name: 'Nuits louées par mois' });
      expect(nuits).toHaveAttribute('aria-valuetext', 'Je ne sais pas');
      fireEvent.change(nuits, { target: { value: '16' } });
      expect(nuits).toHaveAttribute('aria-valuetext', expect.stringMatching(/^16 nuits · 53\s%$/));
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
