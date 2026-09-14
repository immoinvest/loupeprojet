import { encoderCapture, type Capture } from '@loupe/capture';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import { lireProjets } from '@/stockage/projets';

const CAPTURE: Capture = {
  version: 1,
  portail: 'leboncoin',
  url: 'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851?utm_source=ext',
  id: '2214738851',
  prix: 155_000,
  surface: 65,
  pieces: 3,
  chambres: 2,
  ville: 'Marseille 5e',
  codePostal: '13005',
  etage: 3,
  ascenseur: false,
  dpe: 'D',
  chargesCopro: 90,
  taxeFonciere: 1_050,
  description: 'Appartement T3. Honoraires charge acquéreur : 7 000 € inclus. Loué meublé.',
  captureLe: '2026-09-13T10:41:00.000Z',
  mode: 'extension',
  regles: 'leboncoin-2026-09-13',
};

describe('Nouveau projet — depuis l’extension', () => {
  it(
    'lit le fragment, pré-remplit Vérifier, complète avec la description, crée le projet',
    { timeout: 30_000 },
    async () => {
      const utilisateur = userEvent.setup();
      render(<AppEnMemoire chemin={`/projets/nouveau#capture=${encoderCapture(CAPTURE)}`} />);
      await screen.findByRole('heading', { name: /Vérifiez, corrigez/ });

      expect(screen.getByLabelText("Lien de l'annonce")).toHaveValue(
        'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851',
      );
      expect(screen.getByText('leboncoin.fr reconnu')).toBeInTheDocument();
      expect(screen.getByText("lue par l'extension")).toBeInTheDocument();
      expect(screen.getByText(/champs lus dans l'annonce/)).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Il manque quelque chose ?' }),
      ).toBeInTheDocument();

      expect(screen.getByLabelText(/Prix affiché/)).toHaveValue('155000');
      expect(screen.getByLabelText(/Surface/)).toHaveValue('65');
      expect(screen.getByLabelText(/Code postal/)).toHaveValue('13005');
      expect(screen.getByLabelText(/^Ville/)).toHaveValue('Marseille 5e');
      expect(screen.getByLabelText(/^DPE/)).toHaveValue('D');
      expect(screen.getByLabelText(/Ascenseur/)).toHaveValue('non');
      expect(screen.getByLabelText(/Charges de copropriété/)).toHaveValue('90');
      // Les honoraires ne sont pas dans la capture : lus dans la description.
      expect(screen.getByLabelText(/honoraires d'agence/)).toHaveValue('7000');

      await utilisateur.type(screen.getByLabelText(/Loyer visé/), '980');
      await utilisateur.type(screen.getByLabelText(/^Apport/), '15000');
      await utilisateur.click(screen.getByRole('button', { name: /Créer le projet/ }));

      await screen.findByRole(
        'heading',
        { name: /Prix sans repère de marché/ },
        { timeout: 10_000 },
      );
      const cree = lireProjets(window.localStorage)[0];
      expect(cree?.nom).toBe('T3 · 65 m² · Marseille 5e');
      expect(cree?.projet.source).toEqual({
        portail: 'leboncoin',
        id: '2214738851',
        url: 'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851',
      });
      expect(cree?.projet.provenance['achat.prix']).toBe('annonce');
      expect(cree?.projet.hypotheses.achat.honorairesAgence).toBe(7_000);
    },
  );

  it('nomme le bouton-favori quand c’est lui qui a lu la page', async () => {
    render(
      <AppEnMemoire
        chemin={`/projets/nouveau#capture=${encoderCapture({ ...CAPTURE, mode: 'bookmarklet' })}`}
      />,
    );
    await screen.findByRole('heading', { name: /Vérifiez, corrigez/ });
    expect(screen.getByText('lue par le bouton-favori')).toBeInTheDocument();
  });

  it('signale un fragment illisible et laisse le parcours habituel intact', async () => {
    render(<AppEnMemoire chemin="/projets/nouveau#capture=***" />);
    await screen.findByRole('heading', { name: /Colle le lien/ });
    expect(screen.getByText(/capture reçue est illisible/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Vérifiez, corrigez/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Lien de l'annonce")).toHaveValue('');
  });

  it('sans fragment, l’écran ne change pas et renvoie vers la page Extension', async () => {
    render(<AppEnMemoire chemin="/projets/nouveau" />);
    await screen.findByRole('heading', { name: /Colle le lien/ });
    expect(screen.queryByText(/illisible/)).not.toBeInTheDocument();
    expect(screen.queryByText(/lue par/)).not.toBeInTheDocument();
  });
});
