import type { EtatGestion } from '@loupe/gestion';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientMemoire } from '@/compte/memoire';
import type { Utilisateur } from '@/compte/types';
import { clientGestionMemoire } from '@/gestion/memoire';
import type { ClientGestion } from '@/gestion/types';
import { ERREURS_GESTION } from '@/textes/gerer';
import { ERREURS_LOUER, TEXTES_LOUER as T } from '@/textes/gerer-louer';
import { TEXTES_PARCOURS as P } from '@/textes/gerer-parcours';
import { TEXTES_AJOUTER as A } from '@/textes/gerer-saisie';

import { BIEN_LICES, ETAT_SEPTEMBRE } from './gestion-exemples';

const CAMILLE: Utilisateur = {
  id: 'u1',
  nom: 'Camille Roux',
  email: 'camille@example.org',
  image: null,
};

/** Le T2 Lices et le Studio Baille de septembre, plus un parking vacant. */
const AVEC_PARKING: EtatGestion = {
  ...ETAT_SEPTEMBRE,
  biens: [
    ...ETAT_SEPTEMBRE.biens,
    { ...BIEN_LICES, id: 'parking', nom: 'Parking Prado', type: 'parking', meuble: false },
  ],
};

function monter(gestion: ClientGestion, chemin: string): () => void {
  const { unmount } = render(
    <AppEnMemoire
      chemin={chemin}
      compte={clientMemoire({ utilisateur: CAMILLE })}
      gestion={gestion}
    />,
  );
  return unmount;
}

async function formulaire(): Promise<HTMLElement> {
  return screen.findByRole('form', { name: T.formulaire }, { timeout: 10_000 });
}

/** Ouvre la liste « Bien » et choisit le bien dont le nom commence par `nom` (un choix ne compte pas comme un clic). */
async function choisirBien(
  utilisateur: ReturnType<typeof userEvent.setup>,
  form: HTMLElement,
  nom: string,
): Promise<void> {
  await utilisateur.click(within(form).getByRole('button', { name: new RegExp(`^${T.bien} `) }));
  await utilisateur.click(screen.getByRole('option', { name: new RegExp(`^${nom}`) }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Nouveau locataire', () => {
  it('deux clics depuis Mes biens : « Louer » puis « Enregistrer » ; retour avec le message', async () => {
    const utilisateur = userEvent.setup();
    let clics = 0;
    const cliquer = async (element: HTMLElement): Promise<void> => {
      clics += 1;
      await utilisateur.click(element);
    };
    const gestion = clientGestionMemoire({ etat: AVEC_PARKING });
    monter(gestion, '/gerer/biens');

    await cliquer(
      await screen.findByRole('link', { name: 'Louer Parking Prado' }, { timeout: 10_000 }),
    );
    const form = await formulaire();
    expect(
      within(form).getByRole('button', { name: `${T.bien} Parking Prado` }),
    ).toBeInTheDocument();
    // Saisies au clavier : elles ne comptent pas comme des clics.
    await utilisateur.type(within(form).getByLabelText(T.locataire), 'Léa Bernard');
    await utilisateur.type(within(form).getByLabelText(A.loyer), '120');
    await cliquer(within(form).getByRole('button', { name: T.enregistrer }));

    expect(
      await screen.findByRole('heading', { level: 1, name: '3 biens' }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(clics).toBe(2);
    const message = screen.getByRole('status');
    expect(message).toHaveTextContent('Léa Bernard loue Parking Prado.');
    const lea = gestion.donnees().locataires.find((l) => l.prenom === 'Léa');
    expect(within(message).getByRole('link', { name: P.voirSaFiche })).toHaveAttribute(
      'href',
      `/gerer/locataires/${String(lea?.id)}`,
    );
    expect(screen.queryByRole('link', { name: 'Louer Parking Prado' })).toBeNull();
    expect(gestion.donnees().locations).toContainEqual(
      expect.objectContaining({ bienId: 'parking', loyerHorsCharges: 12_000, debut: '2026-09-01' }),
    );
  });

  it('depuis la fiche : une autre chambre en colocation, loyer repris ; retour sur la fiche', async () => {
    const utilisateur = userEvent.setup();
    const gestion = clientGestionMemoire({ etat: ETAT_SEPTEMBRE });
    monter(gestion, '/gerer/biens/bien-lices');
    await utilisateur.click(
      await screen.findByRole('link', { name: 'Ajouter une location' }, { timeout: 10_000 }),
    );
    const form = await formulaire();
    expect(within(form).getByRole('button', { name: `${T.bien} T2 Lices` })).toBeInTheDocument();
    // Repris de la location de Julie.
    expect(within(form).getByLabelText(A.loyer)).toHaveValue('650');
    expect(within(form).getByLabelText(A.charges)).toHaveValue('50');

    await utilisateur.type(within(form).getByLabelText(T.locataire), 'Hugo Petit');
    await utilisateur.click(within(form).getByRole('button', { name: T.ajouterColocataire }));
    await utilisateur.click(within(form).getByRole('button', { name: T.ajouterColocataire }));
    await utilisateur.type(within(form).getByLabelText('Colocataire 1'), 'Léa Bernard');
    await utilisateur.click(within(form).getAllByRole('button', { name: T.retirer })[1]!);
    expect(within(form).queryByLabelText('Colocataire 2')).toBeNull();
    await utilisateur.type(within(form).getByLabelText(T.libelle), 'Chambre 2');
    await utilisateur.click(within(form).getByRole('button', { name: T.enregistrer }));

    expect(
      await screen.findByRole(
        'heading',
        { level: 2, name: 'Location en cours · Chambre 2' },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Hugo Petit loue T2 Lices · Chambre 2.');
    expect(screen.getByRole('link', { name: 'Léa Bernard' })).toBeInTheDocument();
    expect(gestion.donnees().locations).toContainEqual(
      expect.objectContaining({
        bienId: 'bien-lices',
        libelle: 'Chambre 2',
        loyerHorsCharges: 65_000,
      }),
    );
  });

  it('depuis Mes locataires : premier bien vacant, changement de bien, refus du serveur, puis enregistré', async () => {
    const utilisateur = userEvent.setup();
    const gestion = clientGestionMemoire({ etat: AVEC_PARKING });
    monter(gestion, '/gerer/locataires');
    await utilisateur.click(
      await screen.findByRole('link', { name: P.ajouterLocataire }, { timeout: 10_000 }),
    );
    const form = await formulaire();
    expect(
      within(form).getByRole('button', { name: `${T.bien} Parking Prado` }),
    ).toBeInTheDocument();
    expect(within(form).getByLabelText(A.loyer)).toHaveValue('');
    await utilisateur.type(within(form).getByLabelText(T.locataire), 'Léa Bernard');

    // T2 Lices : sa location est reprise, le nom tapé reste.
    await choisirBien(utilisateur, form, 'T2 Lices');
    expect(within(form).getByLabelText(A.loyer)).toHaveValue('650');
    expect(within(form).getByLabelText(T.locataire)).toHaveValue('Léa Bernard');
    await utilisateur.click(within(form).getByRole('button', { name: T.enregistrer }));
    expect(await within(form).findByRole('alert')).toHaveTextContent(ERREURS_GESTION.bien_occupe);

    await choisirBien(utilisateur, form, 'Parking Prado');
    expect(within(form).getByLabelText(A.loyer)).toHaveValue('');
    await utilisateur.type(within(form).getByLabelText(A.loyer), '120');
    await utilisateur.click(within(form).getByRole('button', { name: T.enregistrer }));

    expect(
      await screen.findByRole('heading', { level: 1, name: '3 locataires' }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Léa Bernard loue Parking Prado.');
  });

  it('sans origine : la fiche du nouveau locataire, sans « Voir sa fiche »', async () => {
    const utilisateur = userEvent.setup();
    monter(clientGestionMemoire({ etat: AVEC_PARKING }), '/gerer/locataires/nouveau?bien=parking');
    const form = await formulaire();
    await utilisateur.type(within(form).getByLabelText(T.locataire), 'Léa Bernard');
    await utilisateur.type(within(form).getByLabelText(A.loyer), '120');
    await utilisateur.click(within(form).getByRole('button', { name: T.enregistrer }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Léa Bernard' }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Léa Bernard loue Parking Prado.');
    expect(screen.queryByRole('link', { name: P.voirSaFiche })).toBeNull();
  });

  it('champs à corriger : message, focus sur le premier, rien n’est envoyé', async () => {
    const utilisateur = userEvent.setup();
    const gestion = clientGestionMemoire({ etat: AVEC_PARKING });
    monter(gestion, '/gerer/locataires/nouveau?bien=parking');
    const form = await formulaire();
    await utilisateur.type(within(form).getByLabelText(T.locataire), 'Léa');
    await utilisateur.click(within(form).getByRole('button', { name: T.ajouterColocataire }));
    await utilisateur.type(within(form).getByLabelText('Colocataire 1'), 'Hugo');
    await utilisateur.click(within(form).getByRole('button', { name: T.enregistrer }));

    const locataire = within(form).getByLabelText(T.locataire);
    expect(locataire).toHaveFocus();
    expect(locataire).toHaveAccessibleDescription(ERREURS_LOUER.locataire);
    expect(within(form).getByLabelText('Colocataire 1')).toHaveAccessibleDescription(
      ERREURS_LOUER.colocataires,
    );
    expect(within(form).getByLabelText(A.loyer)).toHaveAccessibleDescription(ERREURS_LOUER.loyer);
    expect(gestion.appels).not.toContain('louer');
  });

  it('adresse hostile ignorée, « Annuler » ; ancienne adresse ?louer=1 redirigée', async () => {
    const utilisateur = userEvent.setup();
    const gestion = clientGestionMemoire({ etat: AVEC_PARKING });
    const demonter = monter(
      gestion,
      '/gerer/locataires/nouveau?bien=inconnu&retour=https%3A%2F%2Fexemple.org',
    );
    const form = await formulaire();
    expect(
      within(form).getByRole('button', { name: `${T.bien} Parking Prado` }),
    ).toBeInTheDocument();
    const fil = screen.getByRole('navigation', { name: P.filAriane });
    expect(within(fil).getByText(P.nouveauLocataire)).toHaveAttribute('aria-current', 'page');
    const annuler = within(form).getByRole('link', { name: T.annuler });
    expect(annuler).toHaveAttribute('href', '/gerer/locataires');
    await utilisateur.click(annuler);
    expect(
      await screen.findByRole('heading', { level: 1, name: '2 locataires' }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(gestion.appels).not.toContain('louer');
    demonter();

    monter(gestion, '/gerer/biens/parking?louer=1');
    const redirige = await formulaire();
    expect(
      within(redirige).getByRole('button', { name: `${T.bien} Parking Prado` }),
    ).toBeInTheDocument();
    expect(within(redirige).getByRole('link', { name: T.annuler })).toHaveAttribute(
      'href',
      '/gerer/biens/parking',
    );
  });

  it('aucun bien vacant : le premier bien, loyer repris ; sans bien : les portes', async () => {
    const demonter = monter(
      clientGestionMemoire({ etat: ETAT_SEPTEMBRE }),
      '/gerer/locataires/nouveau',
    );
    const form = await formulaire();
    expect(
      within(form).getByRole('button', { name: `${T.bien} Studio Baille` }),
    ).toBeInTheDocument();
    expect(within(form).getByLabelText(A.loyer)).toHaveValue('400');
    demonter();

    monter(clientGestionMemoire(), '/gerer/locataires/nouveau');
    expect(
      await screen.findByRole('link', { name: 'Ajouter à la main' }, { timeout: 10_000 }),
    ).toBeInTheDocument();
  });
});
