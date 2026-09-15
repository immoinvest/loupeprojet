import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientMemoire } from '@/compte/memoire';
import type { ClientCompte, Utilisateur } from '@/compte/types';
import { ERREURS_COMPTE } from '@/textes/compte';
import { TEXTES_MON_COMPTE } from '@/textes/mon-compte';

const CAMILLE: Utilisateur = {
  id: 'u_1',
  nom: 'Camille Durand',
  email: 'camille@example.org',
  image: 'https://lh3.googleusercontent.com/photo.jpg',
};

function barreLaterale(): HTMLElement {
  return screen.getAllByRole('complementary').at(-1)!;
}

describe('profil dans la barre latérale et carte de Mes projets', () => {
  it('sans compte : « Se connecter », et « Créer mon compte » mène à la connexion', async () => {
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin="/projets" compte={clientMemoire()} />);
    await screen.findByRole('heading', { name: 'Mes projets' });
    const barre = barreLaterale();
    expect(within(barre).getByText('Sans compte')).toBeInTheDocument();
    expect(within(barre).getByText('Gratuit · 1 projet')).toBeInTheDocument();
    expect(within(barre).getByRole('link', { name: 'Se connecter' })).toHaveAttribute(
      'href',
      '/connexion',
    );

    await utilisateur.click(screen.getByRole('button', { name: 'Créer mon compte' }));
    expect(await screen.findByRole('heading', { name: 'Se connecter' })).toBeInTheDocument();
  });

  it('connecté : initiales, nom, lien vers Mon compte, synchronisation annoncée ; aucune image tierce', async () => {
    render(<AppEnMemoire chemin="/projets" compte={clientMemoire({ utilisateur: CAMILLE })} />);
    const lien = await screen.findByRole('link', { name: /Camille Durand/ });
    expect(lien).toHaveAttribute('href', '/compte');
    expect(within(lien).getByText('CD')).toBeInTheDocument();
    // Le nombre de projets n'est plus répété ici : il est à côté de « Mes projets ».
    expect(within(lien).getByText('Mon compte')).toBeInTheDocument();
    expect(within(lien).queryByText(/projet/)).toBeNull();
    expect(screen.queryByText(TEXTES_MON_COMPTE.carteTitre)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Créer mon compte' })).not.toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('connecté : « Se déconnecter » est visible à côté du nom et ramène à « Sans compte »', async () => {
    const utilisateur = userEvent.setup();
    const compte = clientMemoire({ utilisateur: CAMILLE });
    render(<AppEnMemoire chemin="/projets" compte={compte} />);
    await screen.findByRole('link', { name: /Camille Durand/ });
    const sortir = within(barreLaterale()).getByRole('button', { name: 'Se déconnecter' });
    expect(sortir).toHaveAttribute('title', 'Se déconnecter');

    await utilisateur.click(sortir);
    expect(await within(barreLaterale()).findByText('Sans compte')).toBeInTheDocument();
    expect(within(barreLaterale()).getByRole('link', { name: 'Se connecter' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mes projets' })).toBeInTheDocument();
    expect(await compte.session()).toBeNull();
  });

  it('se déconnecter depuis le menu sur la page Mon compte ramène à l’accueil', async () => {
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin="/compte" compte={clientMemoire({ utilisateur: CAMILLE })} />);
    await screen.findByRole('heading', { name: 'Mon compte' });
    await utilisateur.click(
      within(barreLaterale()).getByRole('button', { name: 'Se déconnecter' }),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bienvenue sur Deklic' }),
    ).toBeInTheDocument();
  });
});

describe('page Mon compte', () => {
  it('sans session, renvoie vers la connexion ; pendant le chargement, patiente', async () => {
    render(<AppEnMemoire chemin="/compte" compte={clientMemoire()} />);
    expect(await screen.findByRole('heading', { name: 'Se connecter' })).toBeInTheDocument();

    const enAttente: ClientCompte = {
      ...clientMemoire(),
      session: () => new Promise(() => undefined),
    };
    render(<AppEnMemoire chemin="/compte" compte={enAttente} />);
    expect(await screen.findByText(TEXTES_MON_COMPTE.chargement)).toBeInTheDocument();
  });

  it(
    'affiche l’adresse sans carte « Connexion » ; renomme, puis se déconnecte',
    { timeout: 60_000 },
    async () => {
      const utilisateur = userEvent.setup();
      const compte = clientMemoire({ utilisateur: { ...CAMILLE, nom: '' }, methodes: ['google'] });
      render(<AppEnMemoire chemin="/compte" compte={compte} />);
      expect(await screen.findByRole('heading', { name: 'Mon compte' })).toBeInTheDocument();
      // Sans nom, l'adresse sert aussi de nom affiché : on la cherche dans la ligne « Adresse e-mail ».
      const ligneEmail = screen.getByText('Adresse e-mail').parentElement!;
      expect(within(ligneEmail).getByText('camille@example.org')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Connexion' })).not.toBeInTheDocument();
      expect(screen.queryByText('Code par e-mail')).not.toBeInTheDocument();

      const enregistrer = screen.getByRole('button', { name: 'Enregistrer' });
      expect(enregistrer).toBeDisabled();
      await utilisateur.type(
        screen.getByRole('textbox', { name: 'Prénom ou nom affiché' }),
        'Camille',
      );
      await utilisateur.click(enregistrer);
      expect(await screen.findByRole('status')).toHaveTextContent("C'est enregistré.");
      expect(within(barreLaterale()).getByText('Camille')).toBeInTheDocument();

      // Le bouton de la page est dans l'en-tête, avant les cartes.
      await utilisateur.click(
        within(screen.getByRole('main')).getByRole('button', { name: 'Se déconnecter' }),
      );
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Bienvenue sur Deklic' }),
      ).toBeInTheDocument();
      expect(within(barreLaterale()).getByText('Sans compte')).toBeInTheDocument();
    },
  );

  it('un renommage refusé s’affiche', async () => {
    const utilisateur = userEvent.setup();
    render(
      <AppEnMemoire
        chemin="/compte"
        compte={clientMemoire({ utilisateur: CAMILLE, erreurs: { renommer: 'reseau' } })}
      />,
    );
    const champ = await screen.findByRole('textbox', { name: 'Prénom ou nom affiché' });
    await utilisateur.type(champ, ' R.');
    await utilisateur.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(ERREURS_COMPTE.reseau);
  });

  it('supprime le compte après confirmation, ou annule', async () => {
    const utilisateur = userEvent.setup();
    const compte = clientMemoire({ utilisateur: CAMILLE });
    render(<AppEnMemoire chemin="/compte" compte={compte} />);
    await utilisateur.click(await screen.findByRole('button', { name: 'Supprimer mon compte' }));
    await utilisateur.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(
      screen.queryByRole('button', { name: 'Oui, supprimer mon compte' }),
    ).not.toBeInTheDocument();

    await utilisateur.click(screen.getByRole('button', { name: 'Supprimer mon compte' }));
    await utilisateur.click(screen.getByRole('button', { name: 'Oui, supprimer mon compte' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bienvenue sur Deklic' }),
    ).toBeInTheDocument();
    expect(await compte.session()).toBeNull();
  });

  it('une session trop ancienne demande de se reconnecter avant de supprimer', async () => {
    const utilisateur = userEvent.setup();
    const compte = clientMemoire({
      utilisateur: CAMILLE,
      erreurs: { supprimer: 'session_ancienne' },
    });
    render(<AppEnMemoire chemin="/compte" compte={compte} />);
    await utilisateur.click(await screen.findByRole('button', { name: 'Supprimer mon compte' }));
    await utilisateur.click(screen.getByRole('button', { name: 'Oui, supprimer mon compte' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(ERREURS_COMPTE.session_ancienne);

    await utilisateur.click(screen.getByRole('button', { name: 'Me reconnecter' }));
    expect(await screen.findByRole('heading', { name: 'Se connecter' })).toBeInTheDocument();
    expect(await compte.session()).toBeNull();
  });
});
