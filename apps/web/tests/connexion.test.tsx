import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientMemoire, CODE_MEMOIRE } from '@/compte/memoire';
import type { ClientCompte } from '@/compte/types';
import { ERREURS_COMPTE } from '@/textes/compte';
import {
  codeEnvoyeA,
  DUREE_CODE_MINUTES,
  echecFournisseur,
  libelleContinuerAvec,
  TEXTES_CONNEXION,
} from '@/textes/connexion';

const EMAIL = 'camille@example.org';

async function ouvrir(compte: ClientCompte, chemin = '/connexion'): Promise<void> {
  render(<AppEnMemoire chemin={chemin} compte={compte} />);
  await screen.findByRole('heading', { name: /Se connecter|Saisissez votre code/ });
}

describe('page de connexion', () => {
  it('une page classique hors de la coque : logotype, Google, Apple, e-mail, continuer sans compte', async () => {
    await ouvrir(clientMemoire());
    expect(await screen.findByRole('button', { name: 'Continuer avec Google' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Continuer avec Apple' })).toBeEnabled();
    expect(screen.getByRole('textbox', { name: 'Adresse e-mail' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recevoir mon code' })).toBeInTheDocument();
    expect(screen.getByText('ou')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continuer sans compte' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.getByRole('link', { name: 'Deklic : accueil' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('img', { name: 'Deklic' })).toBeInTheDocument();
    // Pas de barre latérale sur cette page.
    expect(screen.queryByRole('navigation', { name: 'Mes projets' })).not.toBeInTheDocument();
  });

  it(
    'connexion par code : adresse invalide, envoi, mauvais code, bon code, puis retour demandé',
    { timeout: 60_000 },
    async () => {
      const utilisateur = userEvent.setup();
      const compte = clientMemoire();
      await ouvrir(compte, '/connexion?retour=/comparer');

      const champ = await screen.findByRole('textbox', { name: 'Adresse e-mail' });
      await utilisateur.type(champ, 'camille@');
      await utilisateur.click(screen.getByRole('button', { name: 'Recevoir mon code' }));
      expect(screen.getByRole('alert')).toHaveTextContent(ERREURS_COMPTE.email_invalide);
      expect(compte.codesDemandes).toEqual([]);

      await utilisateur.type(champ, 'example.org');
      await utilisateur.click(screen.getByRole('button', { name: 'Recevoir mon code' }));
      expect(
        await screen.findByRole('heading', { name: 'Saisissez votre code' }),
      ).toBeInTheDocument();
      expect(screen.getByText(codeEnvoyeA(EMAIL))).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(compte.codesDemandes).toEqual([EMAIL]);

      const saisie = screen.getByRole('textbox', { name: 'Code à 6 chiffres' });
      const valider = screen.getByRole('button', { name: 'Me connecter' });
      expect(valider).toBeDisabled();
      await utilisateur.type(saisie, '000 000');
      expect(saisie).toHaveValue('000000');
      await utilisateur.click(valider);
      expect(await screen.findByRole('alert')).toHaveTextContent(ERREURS_COMPTE.code_invalide);

      await utilisateur.clear(saisie);
      await utilisateur.type(saisie, CODE_MEMOIRE);
      await utilisateur.click(screen.getByRole('button', { name: 'Me connecter' }));
      expect(await screen.findByRole('heading', { name: 'Comparer' })).toBeInTheDocument();
    },
  );

  it('renvoie un code et permet de changer d’adresse', { timeout: 60_000 }, async () => {
    const utilisateur = userEvent.setup();
    const compte = clientMemoire();
    await ouvrir(compte);
    await utilisateur.type(await screen.findByRole('textbox', { name: 'Adresse e-mail' }), EMAIL);
    await utilisateur.click(screen.getByRole('button', { name: 'Recevoir mon code' }));
    await screen.findByRole('heading', { name: 'Saisissez votre code' });

    await utilisateur.click(screen.getByRole('button', { name: 'Renvoyer un code' }));
    expect(await screen.findByRole('status')).toHaveTextContent(TEXTES_CONNEXION.codeRenvoye);
    expect(compte.codesDemandes).toEqual([EMAIL, EMAIL]);

    await utilisateur.click(screen.getByRole('button', { name: "Changer d'adresse" }));
    expect(screen.getByRole('heading', { name: 'Se connecter' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Adresse e-mail' })).toHaveValue(EMAIL);
  });

  it('Google et Apple : redirection demandée avec le chemin de retour, ou erreur affichée', async () => {
    const utilisateur = userEvent.setup();
    const compte = clientMemoire();
    const { unmount } = render(
      <AppEnMemoire chemin="/connexion?retour=/projets/nouveau" compte={compte} />,
    );
    await utilisateur.click(await screen.findByRole('button', { name: 'Continuer avec Google' }));
    expect(compte.redirections).toEqual(['google /projets/nouveau']);
    // Le navigateur part chez Google : les boutons restent inactifs pendant ce temps.
    expect(screen.getByRole('button', { name: 'Continuer avec Apple' })).toBeDisabled();
    unmount();

    const enPanne = clientMemoire({ erreurs: { continuerAvec: 'indisponible' } });
    render(<AppEnMemoire chemin="/connexion" compte={enPanne} />);
    await utilisateur.click(await screen.findByRole('button', { name: 'Continuer avec Apple' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(ERREURS_COMPTE.indisponible);
    expect(screen.getByRole('button', { name: 'Continuer avec Apple' })).toBeEnabled();
  });

  it('une erreur du serveur à l’envoi du code s’affiche sans changer d’étape', async () => {
    const utilisateur = userEvent.setup();
    await ouvrir(clientMemoire({ erreurs: { demanderCode: 'trop_de_demandes' } }));
    await utilisateur.type(await screen.findByRole('textbox', { name: 'Adresse e-mail' }), EMAIL);
    await utilisateur.click(screen.getByRole('button', { name: 'Recevoir mon code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(ERREURS_COMPTE.trop_de_demandes);
    expect(screen.getByRole('heading', { name: 'Se connecter' })).toBeInTheDocument();
  });

  it('ne montre que les méthodes proposées par le serveur', async () => {
    await ouvrir(clientMemoire({ fournisseurs: { email: true, google: false, apple: false } }));
    expect(await screen.findByRole('textbox', { name: 'Adresse e-mail' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Continuer avec/ })).not.toBeInTheDocument();
    expect(screen.queryByText('ou')).not.toBeInTheDocument();
  });

  it('Google seul, aucune méthode, ou méthodes encore en chargement', async () => {
    const { unmount } = render(
      <AppEnMemoire
        chemin="/connexion"
        compte={clientMemoire({ fournisseurs: { email: false, google: true, apple: false } })}
      />,
    );
    expect(await screen.findByRole('button', { name: 'Continuer avec Google' })).toBeEnabled();
    expect(screen.queryByRole('textbox', { name: 'Adresse e-mail' })).not.toBeInTheDocument();
    unmount();

    const { unmount: fermer } = render(
      <AppEnMemoire
        chemin="/connexion"
        compte={clientMemoire({ fournisseurs: { email: false, google: false, apple: false } })}
      />,
    );
    expect(await screen.findByText(ERREURS_COMPTE.indisponible)).toBeInTheDocument();
    fermer();

    const enAttente: ClientCompte = {
      ...clientMemoire(),
      fournisseurs: () => new Promise(() => undefined),
    };
    render(<AppEnMemoire chemin="/connexion" compte={enAttente} />);
    expect(await screen.findByText(TEXTES_CONNEXION.chargement)).toBeInTheDocument();
  });

  it('explique l’échec d’un fournisseur, et renvoie une personne déjà connectée', async () => {
    await ouvrir(clientMemoire(), '/connexion?fournisseur=google&error=access_denied');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "La connexion avec Google n'a pas abouti.",
    );

    const connecte = clientMemoire({
      utilisateur: { id: 'u', nom: 'Camille', email: EMAIL, image: null },
    });
    render(<AppEnMemoire chemin="/connexion?retour=/comparer" compte={connecte} />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Comparer' })).toBeInTheDocument();
    });
  });
});

describe('textes de la connexion', () => {
  it('libellés des fournisseurs, code envoyé, échec d’un fournisseur', () => {
    expect(libelleContinuerAvec('apple')).toBe('Continuer avec Apple');
    expect(codeEnvoyeA(EMAIL)).toContain(`${String(DUREE_CODE_MINUTES)} minutes`);
    expect(echecFournisseur('apple')).toContain('Apple');
    expect(echecFournisseur('github')).toBeNull();
    expect(echecFournisseur(null)).toBeNull();
    for (const texte of Object.values(TEXTES_CONNEXION)) expect(texte).not.toContain('—');
  });
});
