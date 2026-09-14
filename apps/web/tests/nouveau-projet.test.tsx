import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import { lireProjets } from '@/stockage/projets';

describe('Nouveau projet — depuis un lien', () => {
  it(
    'lecture impossible : « Saisir à la main » ouvre le formulaire et garde le lien comme source',
    { timeout: 30_000 },
    async () => {
      const utilisateur = userEvent.setup();
      render(<AppEnMemoire chemin="/projets/nouveau" />);
      await screen.findByRole('heading', { name: /Colle le lien/ });

      await utilisateur.click(screen.getByLabelText("Lien de l'annonce"));
      await utilisateur.paste(
        'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851?utm_source=partage',
      );
      expect(screen.getByText('leboncoin.fr reconnu')).toBeInTheDocument();
      expect(screen.getByText('annonce 2214738851')).toBeInTheDocument();
      // Aucune zone de texte à coller, ni avant ni pendant la lecture.
      expect(screen.queryByRole('textbox', { name: /texte/i })).not.toBeInTheDocument();

      // Hors ligne (client par défaut) : la lecture n'est pas disponible.
      expect(await screen.findByRole('alert', {}, { timeout: 5_000 })).toHaveTextContent(
        /pas disponible/,
      );
      await utilisateur.click(screen.getByRole('button', { name: 'Saisir à la main' }));
      await screen.findByRole('heading', { name: /Vérifiez, corrigez/ });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByLabelText("Lien de l'annonce")).toBeInTheDocument();

      await utilisateur.type(screen.getByLabelText(/Prix affiché/), '155000');
      await utilisateur.type(screen.getByLabelText(/^Surface/), '65');
      await utilisateur.type(screen.getByLabelText(/Code postal/), '13005');
      await utilisateur.type(screen.getByLabelText(/^Ville/), 'Marseille 5e');
      await utilisateur.type(screen.getByLabelText(/Loyer visé/), '980');
      await utilisateur.click(screen.getByRole('button', { name: /Créer le projet/ }));

      expect(
        await screen.findByRole(
          'heading',
          { name: /Prix sans repère de marché/ },
          { timeout: 10_000 },
        ),
      ).toBeInTheDocument();
      const cree = lireProjets(window.localStorage)[0];
      expect(cree?.projet.source).toEqual({
        portail: 'leboncoin',
        id: '2214738851',
        url: 'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851',
      });
    },
  );

  it(
    '« J’ai déjà visité ce bien » crée le projet avec la visite faite, sans onglet Visite',
    { timeout: 30_000 },
    async () => {
      const utilisateur = userEvent.setup();
      render(<AppEnMemoire chemin="/projets/nouveau" />);
      await screen.findByRole('heading', { name: /Colle le lien/ });
      await utilisateur.click(screen.getByRole('button', { name: /je saisis à la main/ }));

      await utilisateur.type(screen.getByLabelText(/Prix affiché/), '120000');
      await utilisateur.type(screen.getByLabelText(/^Surface/), '40');
      await utilisateur.type(screen.getByLabelText(/Code postal/), '69003');
      await utilisateur.type(screen.getByLabelText(/^Ville/), 'Lyon');
      await utilisateur.type(screen.getByLabelText(/Loyer visé/), '700');
      await utilisateur.clear(screen.getByLabelText(/^Apport/));
      await utilisateur.type(screen.getByLabelText(/^Apport/), '10000');
      const deja = screen.getByRole('checkbox', { name: /J'ai déjà visité ce bien/ });
      expect(deja).not.toBeChecked();
      await utilisateur.click(deja);
      expect(deja).toBeChecked();
      await utilisateur.click(screen.getByRole('button', { name: /Créer le projet/ }));

      expect(
        await screen.findByRole(
          'heading',
          { name: /Prix sans repère de marché/ },
          { timeout: 10_000 },
        ),
      ).toBeInTheDocument();
      const cree = lireProjets(window.localStorage)[0];
      expect(cree?.visite?.faite).toBe(true);
      expect(cree?.visite?.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(cree?.visite?.reponses).toEqual({});
      const volets = screen.getByRole('navigation', { name: 'Volets du rapport' });
      expect(within(volets).queryByRole('link', { name: 'Visite' })).not.toBeInTheDocument();
      expect(screen.getByText(/Visite faite le .* · aucun problème relevé/)).toBeInTheDocument();
    },
  );

  it('site non reconnu : pas de lecture, la saisie à la main est proposée', async () => {
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin="/projets/nouveau" />);
    await screen.findByRole('heading', { name: /Colle le lien/ });
    await utilisateur.type(
      screen.getByLabelText("Lien de l'annonce"),
      'https://www.exemple.fr/annonce/1',
    );
    expect(screen.getByText(/Site non reconnu/)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    await utilisateur.click(screen.getByRole('button', { name: /je saisis à la main/ }));
    expect(await screen.findByLabelText(/Prix affiché/)).toHaveValue('');
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
    expect(screen.getByText('Indiquez la surface.')).toBeInTheDocument();
    expect(screen.getByText('Code postal à 5 chiffres.')).toBeInTheDocument();
    expect(screen.getByText('Indiquez la ville.')).toBeInTheDocument();
    // Loyer, apport, durée, tranche et revenus sont facultatifs : aucun message pour eux.
    for (const message of [
      'Nombre attendu.',
      'Un montant positif, ou rien.',
      'Entre 1 et 30 ans.',
    ]) {
      expect(screen.queryByText(message)).not.toBeInTheDocument();
    }
    expect(lireProjets(window.localStorage)).toHaveLength(1);
  });

  it(
    'quatre chiffres suffisent : le rapport s’ouvre et attend le loyer',
    { timeout: 30_000 },
    async () => {
      const utilisateur = userEvent.setup();
      render(<AppEnMemoire chemin="/projets/nouveau" />);
      await screen.findByRole('heading', { name: /Colle le lien/ });
      await utilisateur.click(screen.getByRole('button', { name: /je saisis à la main/ }));

      // Les défauts sont affichés, avec le badge « estimé » ; le loyer et les revenus restent vides.
      expect(screen.getByLabelText(/Durée du prêt/)).toHaveValue('25');
      // L'apport attend le bien : 10 % du coût total, dès que prix, surface et code postal sont lisibles.
      expect(screen.getByLabelText(/^Apport/)).toHaveValue('');
      expect(screen.getByText(/^Par défaut, 10\s%\sdu coût total/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Tranche/)).toHaveValue('0.3');
      expect(screen.getByLabelText(/Loyer visé/)).toHaveValue('');
      expect(screen.getAllByText('estimé')).toHaveLength(3);

      await utilisateur.type(screen.getByLabelText(/Prix affiché/), '120000');
      await utilisateur.type(screen.getByLabelText(/Surface/), '40');
      await utilisateur.type(screen.getByLabelText(/Code postal/), '69003');
      await utilisateur.type(screen.getByLabelText(/^Ville/), 'Lyon');
      const apportAffiche = Number(screen.getByLabelText<HTMLInputElement>(/^Apport/).value);
      expect(apportAffiche).toBeGreaterThan(12_000);
      expect(apportAffiche % 100).toBe(0);
      expect(screen.getByText(/^Soit 10\s%\sdu coût total du projet/)).toBeInTheDocument();
      await utilisateur.click(screen.getByRole('button', { name: /Créer le projet/ }));

      await screen.findByRole(
        'heading',
        { name: 'Prix sans repère de marché. Le loyer reste à indiquer.' },
        { timeout: 10_000 },
      );
      const p = lireProjets(window.localStorage)[0]?.projet;
      expect(p?.hypotheses.location).not.toHaveProperty('loyerHc');
      // Le projet reçoit l'apport que montrait le formulaire.
      expect(p?.hypotheses.pret).toMatchObject({
        apport: apportAffiche,
        dureeAnnees: 25,
        tauxNominal: 0.0335,
      });
      expect(p?.hypotheses.fiscalite.tmi).toBe(0.3);
      expect(p?.hypotheses.revenusMensuels).toBeUndefined();
      expect(p?.hypotheses.charges.taxeFonciere).toBe(560);
      expect(p?.provenance).toMatchObject({
        'pret.apport': 'estime',
        'pret.dureeAnnees': 'estime',
        'fiscalite.tmi': 'estime',
        'charges.taxeFonciere': 'estime',
      });
      expect(p?.provenance['location.loyerHc']).toBeUndefined();
    },
  );

  it('un champ facultatif mal rempli est signalé ; modifié, il devient « à toi »', async () => {
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin="/projets/nouveau" />);
    await screen.findByRole('heading', { name: /Colle le lien/ });
    await utilisateur.click(screen.getByRole('button', { name: /je saisis à la main/ }));
    const duree = screen.getByLabelText(/Durée du prêt/);
    await utilisateur.clear(duree);
    await utilisateur.type(duree, '31');
    expect(screen.getAllByText('estimé')).toHaveLength(2);
    await utilisateur.type(screen.getByLabelText(/Loyer visé/), '-5');
    await utilisateur.clear(screen.getByLabelText(/^Apport/));
    await utilisateur.type(screen.getByLabelText(/^Apport/), 'abc');
    await utilisateur.click(screen.getByRole('button', { name: /Créer le projet/ }));
    expect(screen.getByText('Entre 1 et 30 ans.')).toBeInTheDocument();
    expect(screen.getByText('Un montant positif, ou rien.')).toBeInTheDocument();
    expect(screen.getByText('Nombre attendu.')).toBeInTheDocument();
    expect(lireProjets(window.localStorage)).toHaveLength(1);
    // Vidé, un champ facultatif revient au défaut sans erreur.
    await utilisateur.clear(duree);
    await utilisateur.clear(screen.getByLabelText(/Loyer visé/));
    await utilisateur.clear(screen.getByLabelText(/^Apport/));
    await utilisateur.click(screen.getByRole('button', { name: /Créer le projet/ }));
    expect(screen.queryByText('Entre 1 et 30 ans.')).not.toBeInTheDocument();
    expect(screen.queryByText('Nombre attendu.')).not.toBeInTheDocument();
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
      await utilisateur.click(screen.getByRole('radio', { name: 'Nue' }));
      await utilisateur.selectOptions(screen.getByLabelText(/Tranche/), '0.11');
      await utilisateur.selectOptions(screen.getByLabelText(/Ascenseur/), 'oui');
      await utilisateur.selectOptions(screen.getByLabelText(/^DPE/), 'E');
      await utilisateur.type(screen.getByLabelText(/Loyer visé/), '520');
      await utilisateur.clear(screen.getByLabelText(/^Apport/));
      await utilisateur.type(screen.getByLabelText(/^Apport/), '0');
      await utilisateur.clear(screen.getByLabelText(/Durée du prêt/));
      await utilisateur.type(screen.getByLabelText(/Durée du prêt/), '20');
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
