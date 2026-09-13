import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import { lireProjets } from '@/stockage/projets';

const ANNONCE = `Appartement T3 de 65 m² à Marseille 5e (13005), quartier Baille.
Au 3e étage sans ascenseur d'un immeuble construit en 1962.
Prix : 155 000 € (honoraires charge acquéreur : 7 000 € inclus).
2 chambres. Charges de copropriété : 90 € / mois. Taxe foncière : 1 050 €. DPE : D. Loué meublé.`;

describe('Nouveau projet — depuis un lien', () => {
  it(
    'reconnaît le portail, lit le texte collé, pré-remplit, crée le projet et ouvre le rapport',
    { timeout: 30_000 },
    async () => {
      const utilisateur = userEvent.setup();
      render(<AppEnMemoire chemin="/projets/nouveau" />);
      await screen.findByRole('heading', { name: /Colle le lien/ });

      await utilisateur.type(
        screen.getByLabelText("Lien de l'annonce"),
        'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851?utm_source=partage',
      );
      expect(screen.getByText('leboncoin.fr reconnu')).toBeInTheDocument();
      expect(screen.getByText('annonce 2214738851')).toBeInTheDocument();

      const zone = screen.getByPlaceholderText(/Appartement T3 de 65 m²/);
      await utilisateur.click(zone);
      await utilisateur.paste(ANNONCE);
      await utilisateur.click(screen.getByRole('button', { name: 'Lire le texte' }));
      expect(await screen.findByText(/champs lus dans l'annonce, à vérifier/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Prix affiché/)).toHaveValue('155000');
      expect(screen.getByLabelText(/Surface/)).toHaveValue('65');
      expect(screen.getByLabelText(/Code postal/)).toHaveValue('13005');
      expect(screen.getByLabelText(/^Ville/)).toHaveValue('Marseille 5e');
      expect(screen.getByLabelText(/Taxe foncière/)).toHaveValue('1050');
      expect(screen.getAllByText('annonce').length).toBeGreaterThan(5);

      await utilisateur.type(screen.getByLabelText(/Loyer visé/), '980');
      await utilisateur.type(screen.getByLabelText(/^Apport/), '15000');
      await utilisateur.type(screen.getByLabelText(/Vos revenus/), '2600');
      await utilisateur.click(screen.getByRole('button', { name: /Créer le projet/ }));

      expect(
        await screen.findByRole(
          'heading',
          { name: /Prix sans repère de marché/ },
          { timeout: 10_000 },
        ),
      ).toBeInTheDocument();
      const cree = lireProjets(window.localStorage)[0];
      expect(cree?.nom).toBe('T3 · 65 m² · Marseille 5e');
      expect(cree?.projet.source).toEqual({
        portail: 'leboncoin',
        id: '2214738851',
        url: 'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851',
      });
      expect(cree?.projet.hypotheses.charges.taxeFonciere).toBe(1_050);
      expect(cree?.projet.provenance['achat.prix']).toBe('annonce');
    },
  );

  it('signale un site non reconnu et un texte sans rien de lisible', async () => {
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin="/projets/nouveau" />);
    await screen.findByRole('heading', { name: /Colle le lien/ });
    await utilisateur.type(
      screen.getByLabelText("Lien de l'annonce"),
      'https://www.exemple.fr/annonce/1',
    );
    expect(screen.getByText(/Site non reconnu/)).toBeInTheDocument();
    const zone = screen.getByPlaceholderText(/Appartement T3 de 65 m²/);
    await utilisateur.click(zone);
    await utilisateur.paste('bonjour');
    await utilisateur.click(screen.getByRole('button', { name: 'Lire le texte' }));
    expect(await screen.findByText(/Rien de reconnu/)).toBeInTheDocument();
  });
});

describe('Nouveau projet — à la main', () => {
  it('refuse un formulaire vide avec des messages clairs', async () => {
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin="/projets/nouveau" />);
    await screen.findByRole('heading', { name: /Colle le lien/ });
    await utilisateur.click(screen.getByRole('button', { name: /je saisis à la main/ }));
    expect(screen.queryByLabelText("Lien de l'annonce")).not.toBeInTheDocument();
    await utilisateur.click(screen.getByRole('button', { name: /Créer le projet/ }));
    expect(screen.getByText('Indiquez le prix affiché.')).toBeInTheDocument();
    expect(screen.getByText('Code postal à 5 chiffres.')).toBeInTheDocument();
    expect(screen.getByText('Indiquez le loyer visé, hors charges.')).toBeInTheDocument();
    expect(lireProjets(window.localStorage)).toHaveLength(1);
  });

  it(
    'accepte les décimales à la française et les choix (nu, TMI, ascenseur, DPE)',
    { timeout: 30_000 },
    async () => {
      const utilisateur = userEvent.setup();
      render(<AppEnMemoire chemin="/projets/nouveau" />);
      await screen.findByRole('heading', { name: /Colle le lien/ });
      await utilisateur.click(screen.getByRole('button', { name: /je saisis à la main/ }));
      await utilisateur.type(screen.getByLabelText(/Prix affiché/), '98 500');
      await utilisateur.type(screen.getByLabelText(/Surface/), '32,5');
      await utilisateur.type(screen.getByLabelText(/Code postal/), '20000');
      await utilisateur.type(screen.getByLabelText(/^Ville/), 'Ajaccio');
      await utilisateur.selectOptions(screen.getByLabelText(/Mode de location/), 'nu');
      await utilisateur.selectOptions(screen.getByLabelText(/Tranche/), '0.11');
      await utilisateur.selectOptions(screen.getByLabelText(/Ascenseur/), 'oui');
      await utilisateur.selectOptions(screen.getByLabelText(/^DPE/), 'E');
      await utilisateur.type(screen.getByLabelText(/Loyer visé/), '520');
      await utilisateur.type(screen.getByLabelText(/^Apport/), '0');
      await utilisateur.clear(screen.getByLabelText(/Durée du prêt/));
      await utilisateur.type(screen.getByLabelText(/Durée du prêt/), '20');
      await utilisateur.type(screen.getByLabelText(/Vos revenus/), '1900');
      await utilisateur.click(screen.getByRole('button', { name: /Créer le projet/ }));
      await screen.findByRole(
        'heading',
        { name: /Prix sans repère de marché/ },
        { timeout: 10_000 },
      );
      const p = lireProjets(window.localStorage)[0]?.projet;
      expect(p?.bien.departement).toBe('2A');
      expect(p?.bien.surface).toBe(32.5);
      expect(p?.bien.ascenseur).toBe(true);
      expect(p?.bien.dpe).toBe('E');
      expect(p?.hypotheses.fiscalite.tmi).toBe(0.11);
      expect(p?.hypotheses.fiscalite.regime).toBe('nu_reel');
      expect(p?.hypotheses.pret.tauxNominal).toBe(0.0327);
      expect(p?.source).toBeUndefined();
    },
  );
});
