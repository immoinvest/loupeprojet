import type { Depense } from '@loupe/gestion';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientMemoire } from '@/compte/memoire';
import type { Utilisateur } from '@/compte/types';
import { clientArgentMemoire } from '@/gestion/argent/memoire';
import type { ClientArgent } from '@/gestion/argent/types';
import { clientGestionMemoire } from '@/gestion/memoire';
import { ERREURS_DEPENSE, TEXTES_ARGENT, TEXTES_DEPENSE } from '@/textes/gerer-argent';

import { ETAT_SEPTEMBRE, HORODATAGE } from './gestion-exemples';

const CAMILLE: Utilisateur = {
  id: 'u1',
  nom: 'Camille Roux',
  email: 'camille@example.org',
  image: null,
};

const TAXE: Depense = {
  id: 'taxe',
  bienId: 'bien-lices',
  categorie: 'taxe_fonciere',
  montant: 84_000,
  date: '2026-09-10',
  libelle: 'Taxe foncière 2026',
  recuperable: false,
  creeLe: HORODATAGE,
  modifieLe: HORODATAGE,
};

type Utilisateurice = ReturnType<typeof userEvent.setup>;

/** Compte chaque clic qui fait avancer : la règle des deux clics est vérifiée, pas supposée. */
function compteurDeClics(utilisateur: Utilisateurice): {
  cliquer: (element: HTMLElement) => Promise<void>;
  nombre: () => number;
} {
  let clics = 0;
  return {
    cliquer: async (element) => {
      clics += 1;
      await utilisateur.click(element);
    },
    nombre: () => clics,
  };
}

function monter(chemin: string, argent: ClientArgent): void {
  render(
    <AppEnMemoire
      chemin={chemin}
      compte={clientMemoire({ utilisateur: CAMILLE })}
      gestion={clientGestionMemoire({ etat: ETAT_SEPTEMBRE })}
      argent={argent}
    />,
  );
}

function sansEspaces(texte: string | null): string {
  return (texte ?? '').replace(/\s/g, ' ');
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ajouter une dépense', () => {
  it('deux clics depuis la fiche du bien : la carte Argent compte la dépense du mois', async () => {
    const utilisateur = userEvent.setup();
    const clics = compteurDeClics(utilisateur);
    const argent = clientArgentMemoire();
    monter('/gerer/biens/bien-lices', argent);

    await clics.cliquer(
      await screen.findByRole('link', { name: TEXTES_ARGENT.ajouterDepense }, { timeout: 10_000 }),
    );
    const formulaire = await screen.findByRole(
      'form',
      { name: TEXTES_DEPENSE.nouvelle },
      { timeout: 10_000 },
    );
    expect(within(formulaire).getByRole('button', { name: 'Bien T2 Lices' })).toBeInTheDocument();
    await utilisateur.type(within(formulaire).getByLabelText(TEXTES_DEPENSE.montant), '840');
    await utilisateur.click(within(formulaire).getByRole('button', { name: /^Catégorie/ }));
    await utilisateur.click(screen.getByRole('option', { name: 'Taxe foncière' }));
    await clics.cliquer(
      within(formulaire).getByRole('button', { name: TEXTES_DEPENSE.enregistrer }),
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'T2 Lices' }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(clics.nombre()).toBe(2);
    expect(argent.donnees().depenses).toEqual([
      expect.objectContaining({
        bienId: 'bien-lices',
        categorie: 'taxe_fonciere',
        montant: 84_000,
        date: '2026-09-14',
        recuperable: false,
      }),
    ]);
    const ceMois = screen.getByRole('region', { name: TEXTES_ARGENT.ceMois });
    expect(sansEspaces(ceMois.textContent)).toContain('Dépenses840 €');
  });

  it('deux clics depuis la page Argent : une dépense commune qui revient chaque mois', async () => {
    const utilisateur = userEvent.setup();
    const clics = compteurDeClics(utilisateur);
    const argent = clientArgentMemoire();
    monter('/gerer/argent', argent);

    await clics.cliquer(
      await screen.findByRole('link', { name: TEXTES_ARGENT.ajouterDepense }, { timeout: 10_000 }),
    );
    const formulaire = await screen.findByRole(
      'form',
      { name: TEXTES_DEPENSE.nouvelle },
      { timeout: 10_000 },
    );
    await utilisateur.type(within(formulaire).getByLabelText(TEXTES_DEPENSE.montant), '30');
    await utilisateur.type(within(formulaire).getByLabelText(TEXTES_DEPENSE.libelle), 'Comptable');
    await utilisateur.click(
      within(formulaire).getByRole('checkbox', { name: TEXTES_DEPENSE.recuperable }),
    );
    await utilisateur.click(within(formulaire).getByRole('button', { name: /^Revient/ }));
    await utilisateur.click(screen.getByRole('option', { name: 'Tous les mois' }));
    expect(within(formulaire).getByLabelText(TEXTES_DEPENSE.jusquAu)).toBeInTheDocument();
    await clics.cliquer(
      within(formulaire).getByRole('button', { name: TEXTES_DEPENSE.enregistrer }),
    );

    const liste = await screen.findByRole(
      'list',
      { name: TEXTES_ARGENT.depensesDeLaPeriode },
      { timeout: 10_000 },
    );
    expect(clics.nombre()).toBe(2);
    expect(sansEspaces(liste.textContent)).toContain('Comptable');
    expect(sansEspaces(liste.textContent)).toContain(TEXTES_ARGENT.commune);
    expect(argent.donnees().depenses[0]).toMatchObject({
      recuperable: true,
      recurrence: { frequence: 'mensuelle' },
    });
    expect(argent.donnees().depenses[0]).not.toHaveProperty('bienId');
  });

  it('un montant manquant est signalé, le curseur y va, rien n’est envoyé ; « Annuler » ramène', async () => {
    const utilisateur = userEvent.setup();
    const argent = clientArgentMemoire();
    monter('/gerer/depenses/nouvelle?bien=bien-lices&retour=%2Fgerer%2Fbiens%2Fbien-lices', argent);
    const formulaire = await screen.findByRole(
      'form',
      { name: TEXTES_DEPENSE.nouvelle },
      { timeout: 10_000 },
    );
    await utilisateur.click(
      within(formulaire).getByRole('button', { name: TEXTES_DEPENSE.enregistrer }),
    );
    expect(within(formulaire).getByText(ERREURS_DEPENSE.montant)).toBeInTheDocument();
    expect(within(formulaire).getByLabelText(TEXTES_DEPENSE.montant)).toHaveFocus();
    expect(argent.appels).toEqual(['etat']);
    expect(within(formulaire).getByRole('link', { name: TEXTES_DEPENSE.annuler })).toHaveAttribute(
      'href',
      '/gerer/biens/bien-lices',
    );
  });

  it('une erreur de l’API s’affiche dans le formulaire', async () => {
    const utilisateur = userEvent.setup();
    monter(
      '/gerer/depenses/nouvelle',
      clientArgentMemoire({ erreurs: { ajouterDepense: 'limite' } }),
    );
    const formulaire = await screen.findByRole(
      'form',
      { name: TEXTES_DEPENSE.nouvelle },
      { timeout: 10_000 },
    );
    await utilisateur.type(within(formulaire).getByLabelText(TEXTES_DEPENSE.montant), '12');
    await utilisateur.click(
      within(formulaire).getByRole('button', { name: TEXTES_DEPENSE.enregistrer }),
    );
    expect(await within(formulaire).findByRole('alert')).toHaveTextContent('2 000 dépenses');
  });
});

describe('modifier et supprimer une dépense', () => {
  it('le nom de la dépense ouvre « Modifier » ; « Enregistrer » ramène sur Argent avec le nouveau montant', async () => {
    const utilisateur = userEvent.setup();
    const clics = compteurDeClics(utilisateur);
    const argent = clientArgentMemoire({ etat: { depenses: [TAXE], prets: [] } });
    monter('/gerer/argent', argent);

    await clics.cliquer(
      await screen.findByRole('link', { name: 'Taxe foncière 2026' }, { timeout: 10_000 }),
    );
    const formulaire = await screen.findByRole(
      'form',
      { name: TEXTES_DEPENSE.modifier },
      { timeout: 10_000 },
    );
    const champ = within(formulaire).getByLabelText(TEXTES_DEPENSE.montant);
    expect(champ).toHaveValue('840');
    await utilisateur.clear(champ);
    await utilisateur.type(champ, '910');
    await clics.cliquer(
      within(formulaire).getByRole('button', { name: TEXTES_DEPENSE.enregistrer }),
    );

    expect(
      await screen.findByRole(
        'list',
        { name: TEXTES_ARGENT.depensesDeLaPeriode },
        { timeout: 10_000 },
      ),
    ).toHaveTextContent(/910/);
    expect(clics.nombre()).toBe(2);
    expect(argent.donnees().depenses[0]?.montant).toBe(91_000);
  });

  it('« Supprimer cette dépense » puis « Supprimer définitivement » ; « Annuler » referme', async () => {
    const utilisateur = userEvent.setup();
    const argent = clientArgentMemoire({ etat: { depenses: [TAXE], prets: [] } });
    monter('/gerer/depenses/taxe?retour=%2Fgerer%2Fargent', argent);

    await utilisateur.click(
      await screen.findByRole('button', { name: TEXTES_DEPENSE.supprimer }, { timeout: 10_000 }),
    );
    await utilisateur.click(screen.getByRole('button', { name: TEXTES_DEPENSE.annuler }));
    await utilisateur.click(screen.getByRole('button', { name: TEXTES_DEPENSE.supprimer }));
    const confirmation = screen.getByRole('region', { name: TEXTES_DEPENSE.confirmerTitre });
    await utilisateur.click(
      within(confirmation).getByRole('button', { name: TEXTES_DEPENSE.supprimerDefinitivement }),
    );
    expect(
      await screen.findByText(TEXTES_ARGENT.aucuneDepense, {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(argent.donnees().depenses).toEqual([]);
  });

  it('suppression refusée : le message reste affiché ; dépense inconnue : lien vers Argent', async () => {
    const utilisateur = userEvent.setup();
    monter(
      '/gerer/depenses/taxe',
      clientArgentMemoire({
        etat: { depenses: [TAXE], prets: [] },
        erreurs: { supprimerDepense: 'reseau' },
      }),
    );
    await utilisateur.click(
      await screen.findByRole('button', { name: TEXTES_DEPENSE.supprimer }, { timeout: 10_000 }),
    );
    await utilisateur.click(
      screen.getByRole('button', { name: TEXTES_DEPENSE.supprimerDefinitivement }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de joindre Deklic');
  });

  it('dépense inconnue : un lien vers Argent', async () => {
    monter('/gerer/depenses/inconnue', clientArgentMemoire());
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: TEXTES_DEPENSE.introuvable },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: TEXTES_DEPENSE.voirArgent })).toHaveAttribute(
      'href',
      '/gerer/argent',
    );
  });
});

describe('migration 0007 pas encore appliquée', () => {
  it('Argent et les formulaires disent « Bientôt disponible » ; la fiche et les loyers marchent', async () => {
    const indisponible = clientArgentMemoire({ erreurs: { etat: 'indisponible' } });
    const { unmount } = render(
      <AppEnMemoire
        chemin="/gerer/argent"
        compte={clientMemoire({ utilisateur: CAMILLE })}
        gestion={clientGestionMemoire({ etat: ETAT_SEPTEMBRE })}
        argent={indisponible}
      />,
    );
    expect(
      await screen.findByText(TEXTES_ARGENT.bientot, {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
    unmount();

    monter('/gerer/biens/bien-lices', indisponible);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'T2 Lices' }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(TEXTES_ARGENT.bientot, {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Les 12 derniers mois' })).toBeInTheDocument();
  });

  it('autre panne : le message et « Réessayer » sur la page Nouvelle dépense', async () => {
    monter('/gerer/depenses/nouvelle', clientArgentMemoire({ erreurs: { etat: 'reseau' } }));
    expect(await screen.findByRole('alert', {}, { timeout: 10_000 })).toHaveTextContent(
      'Impossible de joindre Deklic',
    );
    expect(screen.getByRole('button', { name: TEXTES_ARGENT.reessayer })).toBeInTheDocument();
  });
});
