import { PREFERENCES_PAR_DEFAUT } from '@loupe/gestion';
import { LocationSchema } from '@loupe/moteur';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientMemoire } from '@/compte/memoire';
import type { ClientCompte, Utilisateur } from '@/compte/types';
import { clientGestionMemoire, ETAT_GESTION_VIDE } from '@/gestion/memoire';
import type { ClientGestion } from '@/gestion/types';
import {
  creerProjet,
  ecrireProjets,
  lireProjets,
  type AdresseBien,
  type StatutProjet,
} from '@/stockage/projets';
import { ERREURS_GESTION } from '@/textes/gerer';
import { TEXTES_GERER } from '@/textes/gerer-ecrans';
import { ERREURS_PRET, TEXTES_PRET } from '@/textes/gerer-pret';

const CAMILLE: Utilisateur = {
  id: 'u1',
  nom: 'Camille Roux',
  email: 'camille@example.org',
  image: null,
};

const ADRESSE: AdresseBien = {
  libelle: '12 rue des Lices 13005 Marseille',
  lat: 43.2931,
  lon: 5.3942,
  codeInsee: '13205',
  codeVoie: '5470',
  numero: 12,
  codePostal: '13005',
};

/** Enregistre le projet d'exemple (en offre faite, avec une adresse) et rend son identifiant. */
function enregistrerProjet(
  statut: StatutProjet = 'offre',
  adresse: AdresseBien | null = ADRESSE,
): string {
  const p = creerProjet({ nom: 'T3 · 65 m² · Marseille 5e', statut });
  ecrireProjets(window.localStorage, [adresse === null ? p : { ...p, adresse }]);
  return p.id;
}

function monter(
  chemin: string,
  gestion: ClientGestion,
  compte: ClientCompte = clientMemoire({ utilisateur: CAMILLE }),
): void {
  render(<AppEnMemoire chemin={chemin} compte={compte} gestion={gestion} />);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('porte ouverte par le statut « Acheté »', () => {
  it('deux gestes depuis le projet : le bien, la location et l’instantané de l’analyse ; projet « Acheté »', async () => {
    const utilisateur = userEvent.setup();
    let clics = 0;
    const cliquer = async (element: HTMLElement): Promise<void> => {
      clics += 1;
      await utilisateur.click(element);
    };
    const id = enregistrerProjet();
    const gestion = clientGestionMemoire();
    const { unmount } = render(
      <AppEnMemoire
        chemin={`/projets/${id}`}
        compte={clientMemoire({ utilisateur: CAMILLE })}
        gestion={gestion}
      />,
    );

    // Le compte est lu : sans quoi le statut ne saurait pas encore qu'il peut ouvrir Gérer.
    await waitFor(
      () => {
        expect(gestion.appels).toContain('etat');
      },
      { timeout: 5_000 },
    );
    await act(() => new Promise((fin) => setTimeout(fin, 0)));
    clics += 1;
    await utilisateur.selectOptions(await screen.findByLabelText('Statut du projet'), 'achete');
    expect(
      await screen.findByRole('heading', { level: 1, name: TEXTES_PRET.titre }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(TEXTES_PRET.adresse)).toHaveValue(ADRESSE.libelle);
    expect(screen.getByText('1er octobre 2026')).toBeInTheDocument();
    await utilisateur.type(screen.getByLabelText(TEXTES_PRET.locataire), 'Julie Martin');
    await cliquer(screen.getByRole('button', { name: TEXTES_PRET.cestParti }));

    // Création, navigation puis rendu de l'accueil : plus d'une seconde quand toute la suite tourne.
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'Aucun loyer attendu ce mois-ci.' },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument();
    expect(clics).toBe(2);
    // Le locataire entre le mois prochain : ce n'est pas un bien vacant.
    expect(
      screen.getByText('Entrée à venir : T3 · 65 m² · Marseille 5e le 1er octobre 2026'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Sans locataire/)).toBeNull();
    const [bien] = gestion.donnees().biens;
    expect(bien).toMatchObject({
      nom: 'T3 · 65 m² · Marseille 5e',
      projetId: id,
      codePostal: '13005',
    });
    expect(bien?.projet).toMatchObject({ id });
    expect(gestion.donnees().locataires).toEqual([
      expect.objectContaining({ prenom: 'Julie', nom: 'Martin' }),
    ]);
    expect(gestion.donnees().locations).toEqual([
      expect.objectContaining({ debut: '2026-10-01', jourLoyer: 5 }),
    ]);
    expect(lireProjets(window.localStorage)[0]?.statut).toBe('achete');

    // De retour sur le projet : le bien est géré, plus de lien vers la porte.
    unmount();
    monter(`/projets/${id}`, gestion);
    expect(await screen.findByRole('button', { name: 'PDF' })).toBeInTheDocument();
    // Le compte se relit à la remontée : sous charge, plus d'une seconde.
    await waitFor(
      () => {
        expect(screen.queryByRole('link', { name: TEXTES_PRET.gererCeBien })).toBeNull();
      },
      { timeout: 5_000 },
    );
  });

  it('« Pas encore loué » : un bien vacant, en deux clics aussi', async () => {
    const utilisateur = userEvent.setup();
    const id = enregistrerProjet();
    const gestion = clientGestionMemoire();
    monter(`/gerer/pret/${id}`, gestion);
    await utilisateur.click(await screen.findByRole('button', { name: TEXTES_PRET.pasEncoreLoue }));
    // Le nom du bien vacant est un lien vers sa fiche : le texte se lit sur tout le paragraphe.
    expect(await screen.findByText(/^Sans locataire/, {}, { timeout: 10_000 })).toHaveTextContent(
      'Sans locataire : T3 · 65 m² · Marseille 5e',
    );
    expect(gestion.donnees()).toMatchObject({ locataires: [], locations: [] });
  });

  it('adresse manquante et locataire incomplet : messages, focus sur l’adresse, rien n’est créé', async () => {
    const utilisateur = userEvent.setup();
    const id = enregistrerProjet('offre', null);
    const gestion = clientGestionMemoire();
    monter(`/gerer/pret/${id}`, gestion);
    await utilisateur.type(await screen.findByLabelText(TEXTES_PRET.locataire), 'Julie');
    await utilisateur.click(screen.getByRole('button', { name: TEXTES_PRET.cestParti }));
    const adresse = screen.getByLabelText(TEXTES_PRET.adresse);
    expect(adresse).toHaveFocus();
    expect(adresse).toHaveAccessibleDescription(ERREURS_PRET.adresse);
    expect(screen.getByLabelText(TEXTES_PRET.locataire)).toHaveAccessibleDescription(
      ERREURS_PRET.locataire,
    );
    expect(gestion.appels).not.toContain('creer');
    expect(lireProjets(window.localStorage)[0]?.statut).toBe('offre');
  });

  it('analyse sans loyer : « C’est parti » renvoie vers Hypothèses, « Pas encore loué » reste possible', async () => {
    const utilisateur = userEvent.setup();
    const base = creerProjet({ nom: 'T3 · 65 m² · Marseille 5e', statut: 'offre' });
    const location = LocationSchema.parse({ mode: 'nu', chargesLocataire: 40 });
    const hypotheses = { ...base.projet.hypotheses, location };
    const p = { ...base, adresse: ADRESSE, projet: { ...base.projet, hypotheses } };
    ecrireProjets(window.localStorage, [p]);
    const gestion = clientGestionMemoire();
    monter(`/gerer/pret/${p.id}`, gestion);

    expect(await screen.findByText(TEXTES_PRET.loyerInconnu)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: TEXTES_PRET.ajouterLoyer })).toHaveAttribute(
      'href',
      `/projets/${p.id}/hypotheses`,
    );
    await utilisateur.type(screen.getByLabelText(TEXTES_PRET.locataire), 'Julie Martin');
    await utilisateur.click(screen.getByRole('button', { name: TEXTES_PRET.cestParti }));
    expect(screen.getByText(ERREURS_PRET.loyer, { exact: false })).toHaveFocus();
    expect(gestion.appels).not.toContain('creer');

    await utilisateur.click(screen.getByRole('button', { name: TEXTES_PRET.pasEncoreLoue }));
    expect(await screen.findByText(/^Sans locataire/, {}, { timeout: 10_000 })).toHaveTextContent(
      'Sans locataire : T3 · 65 m² · Marseille 5e',
    );
    expect(gestion.donnees()).toMatchObject({ locataires: [], locations: [] });
  });

  it('une création refusée s’affiche et le projet reste en offre', async () => {
    const utilisateur = userEvent.setup();
    const id = enregistrerProjet();
    monter(`/gerer/pret/${id}`, clientGestionMemoire({ erreurs: { creer: 'reseau' } }));
    await utilisateur.click(await screen.findByRole('button', { name: TEXTES_PRET.pasEncoreLoue }));
    expect(await screen.findByRole('alert')).toHaveTextContent(ERREURS_GESTION.reseau);
    expect(lireProjets(window.localStorage)[0]?.statut).toBe('offre');
  });

  it('projet introuvable', async () => {
    monter('/gerer/pret/inconnu', clientGestionMemoire());
    expect(
      await screen.findByRole('heading', { level: 1, name: TEXTES_PRET.introuvable }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: TEXTES_PRET.retourProjets })).toHaveAttribute(
      'href',
      '/projets',
    );
  });

  it('sans compte : la page explique pourquoi il en faut un', async () => {
    const id = enregistrerProjet();
    monter(`/gerer/pret/${id}`, clientGestionMemoire(), clientMemoire());
    expect(
      await screen.findByRole('heading', { level: 1, name: TEXTES_GERER.sansCompteTitre }),
    ).toBeInTheDocument();
  });

  it('l’en-tête ne propose plus « J’ai acheté ce bien » : Partager est l’action principale', async () => {
    const id = enregistrerProjet();
    monter(`/projets/${id}`, clientGestionMemoire());
    expect(await screen.findByRole('button', { name: 'Partager' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /acheté ce bien/ })).toBeNull();
    expect(screen.queryByRole('link', { name: TEXTES_PRET.gererCeBien })).toBeNull();
  });

  it('le lien « Gérer ce bien » disparaît dès que les préférences du compte masquent Gérer', async () => {
    const id = enregistrerProjet('achete');
    monter(
      `/projets/${id}`,
      clientGestionMemoire({
        etat: { ...ETAT_GESTION_VIDE, preferences: { analyser: true, gerer: false } },
      }),
    );
    expect(await screen.findByRole('button', { name: 'PDF' })).toBeInTheDocument();
    // Avant la lecture du compte, les deux sections sont affichées ; le lien disparaît quand les
    // préférences arrivent. S'il ne disparaît jamais, échec.
    await waitFor(
      () => {
        expect(screen.queryByRole('link', { name: TEXTES_PRET.gererCeBien })).toBeNull();
      },
      { timeout: 5_000 },
    );
  });

  it('sans compte, « Acheté » reste sur le projet et propose le lien vers Gérer', async () => {
    const utilisateur = userEvent.setup();
    const id = enregistrerProjet();
    monter(`/projets/${id}`, clientGestionMemoire(), clientMemoire());
    await utilisateur.selectOptions(await screen.findByLabelText('Statut du projet'), 'achete');
    expect(lireProjets(window.localStorage)[0]?.statut).toBe('achete');
    expect(screen.getByRole('button', { name: 'PDF' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: TEXTES_PRET.gererCeBien })).toHaveAttribute(
      'href',
      `/gerer/pret/${id}`,
    );
  });

  it('un projet acheté, compte prêt, sans bien géré : le lien mène à la porte', async () => {
    const id = enregistrerProjet('achete');
    monter(
      `/projets/${id}`,
      clientGestionMemoire({ etat: { ...ETAT_GESTION_VIDE, preferences: PREFERENCES_PAR_DEFAUT } }),
    );
    expect(await screen.findByRole('link', { name: TEXTES_PRET.gererCeBien })).toHaveAttribute(
      'href',
      `/gerer/pret/${id}`,
    );
  });
});
