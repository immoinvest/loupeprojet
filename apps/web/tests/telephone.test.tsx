import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi, type Mock, type MockInstance } from 'vitest';

import { AppEnMemoire } from '@/App';
import { LONGUEUR_MAX_TEXTE_PARTAGE } from '@/annonces';
import { creerSuiviInstallation, type FenetreInstallation } from '@/application';
import { creerProjet, ecrireProjets } from '@/stockage/projets';
import {
  TEXTES_CARTE_TELEPHONE,
  TEXTES_INSTALLATION,
  TEXTES_PARTAGE_RECU,
} from '@/textes/application';
import { TEXTES_PARTAGE_PROJET } from '@/textes/partage';

const LEBONCOIN = 'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851';

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, 'matchMedia');
  Reflect.deleteProperty(navigator, 'share');
});

/** Un écran tactile : `(pointer: coarse)` est vrai, les autres requêtes fausses. */
function ecranTactile(): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (requete: string) => ({
      matches: requete === '(pointer: coarse)',
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

/** `navigator.share` simulé, qui rend le résultat donné. */
function feuilleDePartage(resultat: () => Promise<void>): Mock<() => Promise<void>> {
  const share = vi.fn(resultat);
  Object.defineProperty(navigator, 'share', { configurable: true, writable: true, value: share });
  return share;
}

/** Un projet enregistré, puis son rapport ouvert ; rend l'utilisateur et l'espion du presse-papiers. */
async function ouvrirProjet(): Promise<{
  utilisateur: ReturnType<typeof userEvent.setup>;
  writeText: MockInstance<(texte: string) => Promise<void>>;
}> {
  ecrireProjets(window.localStorage, [creerProjet({ nom: 'À partager', genererId: () => 'p1' })]);
  const utilisateur = userEvent.setup();
  const writeText = vi.spyOn(navigator.clipboard, 'writeText');
  render(<AppEnMemoire chemin="/projets/p1" />);
  await screen.findByRole('navigation', { name: 'Volets du rapport' });
  return { utilisateur, writeText };
}

describe('Partager un projet depuis le téléphone', () => {
  it('au doigt, la boîte montre le lien copié et « Envoyer » ouvre la feuille de partage', async () => {
    ecranTactile();
    const share = feuilleDePartage(() => Promise.resolve());
    const { utilisateur, writeText } = await ouvrirProjet();
    writeText.mockResolvedValue(undefined);

    await utilisateur.click(screen.getByRole('button', { name: TEXTES_PARTAGE_PROJET.partager }));
    const boite = await screen.findByRole('dialog', { name: TEXTES_PARTAGE_PROJET.titre });
    expect(
      await within(boite).findByRole('button', { name: TEXTES_PARTAGE_PROJET.copie }),
    ).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/partage#p='));
    expect(share).not.toHaveBeenCalled();

    await utilisateur.click(
      within(boite).getByRole('button', { name: TEXTES_PARTAGE_PROJET.envoyer }),
    );
    expect(share).toHaveBeenCalledWith({
      title: 'À partager',
      text: TEXTES_PARTAGE_PROJET.message('À partager'),
      url: expect.stringContaining('/partage#p=') as string,
    });
    expect(await within(boite).findByRole('status')).toHaveTextContent(
      TEXTES_PARTAGE_PROJET.partage,
    );
    expect(within(boite).getByText(TEXTES_PARTAGE_PROJET.avertissement)).toBeInTheDocument();
  });

  it('feuille fermée sans choisir : la boîte reste, sans « Lien partagé »', async () => {
    ecranTactile();
    const share = feuilleDePartage(() => Promise.reject(new DOMException('fermée', 'AbortError')));
    const { utilisateur, writeText } = await ouvrirProjet();
    writeText.mockResolvedValue(undefined);

    await utilisateur.click(screen.getByRole('button', { name: TEXTES_PARTAGE_PROJET.partager }));
    const boite = await screen.findByRole('dialog', { name: TEXTES_PARTAGE_PROJET.titre });
    await utilisateur.click(
      within(boite).getByRole('button', { name: TEXTES_PARTAGE_PROJET.envoyer }),
    );
    expect(share).toHaveBeenCalledTimes(1);
    expect(within(boite).getByRole('status')).not.toHaveTextContent(TEXTES_PARTAGE_PROJET.partage);
  });

  it('à la souris, pas de bouton « Envoyer » : le lien copié suffit', async () => {
    const share = feuilleDePartage(() => Promise.resolve());
    const { utilisateur, writeText } = await ouvrirProjet();
    writeText.mockResolvedValue(undefined);

    await utilisateur.click(screen.getByRole('button', { name: TEXTES_PARTAGE_PROJET.partager }));
    const boite = await screen.findByRole('dialog', { name: TEXTES_PARTAGE_PROJET.titre });
    expect(
      await within(boite).findByRole('button', { name: TEXTES_PARTAGE_PROJET.copie }),
    ).toBeInTheDocument();
    expect(within(boite).getByText(TEXTES_PARTAGE_PROJET.avertissement)).toBeInTheDocument();
    expect(within(boite).queryByRole('button', { name: TEXTES_PARTAGE_PROJET.envoyer })).toBeNull();
    expect(share).not.toHaveBeenCalled();
  });
});

describe('Recevoir une annonce partagée', () => {
  it('le lien trouvé dans le texte pré-remplit Nouveau projet', async () => {
    const texte = encodeURIComponent(`Regarde cette annonce ${LEBONCOIN}`);
    render(<AppEnMemoire chemin={`/projets/nouveau?texte=${texte}`} />);
    await screen.findByRole('heading', { level: 1, name: /Colle le lien/ });

    expect(screen.getByLabelText("Lien de l'annonce")).toHaveValue(LEBONCOIN);
    expect(screen.getByText('leboncoin.fr reconnu')).toBeInTheDocument();
    expect(screen.getByText(TEXTES_PARTAGE_RECU.pastille)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: "Lecture de l'annonce" })).toBeInTheDocument();
  });

  it('un site non reconnu garde son lien, sans la pastille du partage', async () => {
    const texte = encodeURIComponent('Vu ici https://exemple.fr/annonce/42');
    render(<AppEnMemoire chemin={`/projets/nouveau?texte=${texte}`} />);
    await screen.findByRole('heading', { level: 1, name: /Colle le lien/ });

    expect(screen.getByLabelText("Lien de l'annonce")).toHaveValue('https://exemple.fr/annonce/42');
    expect(screen.getByText(/Site non reconnu/)).toBeInTheDocument();
    expect(screen.queryByText(TEXTES_PARTAGE_RECU.pastille)).toBeNull();
  });

  it('un texte partagé sans lien est lu tout de suite : le formulaire s’ouvre pré-rempli', async () => {
    const annonce = 'Appartement T3 de 65 m² au 3e étage. Prix : 155 000 €. DPE : D.';
    render(<AppEnMemoire chemin={`/projets/nouveau?texte=${encodeURIComponent(annonce)}`} />);
    await screen.findByRole('heading', { name: /Vérifiez, corrigez/ });

    expect(screen.getByLabelText(/Prix affiché/)).toHaveValue('155000');
    expect(screen.getByLabelText(/^Surface/)).toHaveValue('65');
    expect(screen.queryByText(TEXTES_PARTAGE_RECU.pastille)).toBeNull();
  });

  it('un texte démesuré est lu tronqué à 10 000 caractères, et rien n’en est gardé', async () => {
    const demesure = `T3 lumineux ${'a'.repeat(20_000)}`;
    expect(demesure.length).toBeGreaterThan(LONGUEUR_MAX_TEXTE_PARTAGE);
    render(<AppEnMemoire chemin={`/projets/nouveau?texte=${encodeURIComponent(demesure)}`} />);
    await screen.findByRole('heading', { name: /Vérifiez, corrigez/ });

    const stocke = Array.from({ length: window.localStorage.length }, (_, i) =>
      window.localStorage.getItem(window.localStorage.key(i) ?? ''),
    ).join('');
    expect(stocke).not.toContain('aaaaaaaaaa');
  });

  it('une capture de l’extension dans l’adresse reste prioritaire', async () => {
    const lien = encodeURIComponent(LEBONCOIN);
    render(<AppEnMemoire chemin={`/projets/nouveau?lien=${lien}#capture=***`} />);
    await screen.findByRole('heading', { level: 1, name: /Colle le lien/ });

    expect(screen.getByText(/capture reçue est illisible/)).toBeInTheDocument();
    expect(screen.getByLabelText("Lien de l'annonce")).toHaveValue('');
  });
});

describe('Page Extension : carte « Sur téléphone et tablette »', () => {
  function carte(): HTMLElement {
    const titre = screen.getByRole('heading', { level: 2, name: TEXTES_CARTE_TELEPHONE.titre });
    const section = titre.closest('section');
    if (section === null) throw new Error('carte introuvable');
    return section;
  }

  it('sans invite du navigateur, explique l’installation sur Android et iPhone', async () => {
    render(<AppEnMemoire chemin="/extension" />);
    await screen.findByRole('heading', { level: 2, name: TEXTES_CARTE_TELEPHONE.titre });
    expect(within(carte()).getByText(TEXTES_CARTE_TELEPHONE.installerAndroid)).toBeInTheDocument();
    expect(within(carte()).getByText(TEXTES_CARTE_TELEPHONE.installerIphone)).toBeInTheDocument();
    expect(within(carte()).getByText(TEXTES_CARTE_TELEPHONE.envoyerAndroid)).toBeInTheDocument();
  });

  it('propose le bouton quand le navigateur le permet, et dit quand c’est déjà installé', async () => {
    const ecouteurs: ((evenement: Event) => void)[] = [];
    const fenetre: FenetreInstallation = {
      addEventListener: (type, ecouteur) => {
        if (type === 'beforeinstallprompt') ecouteurs.push(ecouteur);
      },
    };
    const suivi = creerSuiviInstallation(fenetre);
    const invite = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: () => Promise.resolve(),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    for (const ecouteur of ecouteurs) ecouteur(invite);
    const { unmount } = render(<AppEnMemoire chemin="/extension" installation={suivi} />);
    await screen.findByRole('heading', { level: 2, name: TEXTES_CARTE_TELEPHONE.titre });
    expect(
      within(carte()).getByRole('button', { name: TEXTES_INSTALLATION.bouton }),
    ).toBeInTheDocument();
    unmount();

    const installee = creerSuiviInstallation({
      addEventListener: () => undefined,
      matchMedia: () => ({ matches: true }),
    });
    render(<AppEnMemoire chemin="/extension" installation={installee} />);
    await screen.findByRole('heading', { level: 2, name: TEXTES_CARTE_TELEPHONE.titre });
    expect(within(carte()).getByText(TEXTES_CARTE_TELEPHONE.installee)).toBeInTheDocument();
  });
});
