import type { BienGere, Depense, EtatGestion, PretEnregistre } from '@loupe/gestion';
import { projetExemple } from '@loupe/moteur';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientMemoire } from '@/compte/memoire';
import type { Utilisateur } from '@/compte/types';
import { clientArgentMemoire } from '@/gestion/argent/memoire';
import type { ClientArgent } from '@/gestion/argent/types';
import { clientGestionMemoire } from '@/gestion/memoire';
import { TEXTES_ARGENT, TEXTES_PRET } from '@/textes/gerer-argent';

import { BIEN_LICES, ETAT_SEPTEMBRE, HORODATAGE } from './gestion-exemples';

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
  recuperable: false,
  creeLe: HORODATAGE,
  modifieLe: HORODATAGE,
};

const PRET: PretEnregistre = {
  bienId: 'bien-lices',
  capital: 1_200_000,
  tauxAnnuel: 0.12,
  dureeMois: 12,
  debut: '2026-09',
  assuranceMensuelle: 500,
  modifieLe: HORODATAGE,
};

/** Le T2 Lices acheté depuis le projet d'exemple (emprunt compris). */
const ACHETE: BienGere = { ...BIEN_LICES, projetId: 'p1', projet: { ...projetExemple } };
const ETAT_ACHETE: EtatGestion = {
  ...ETAT_SEPTEMBRE,
  biens: [ACHETE, ...ETAT_SEPTEMBRE.biens.slice(1)],
};

function monter(chemin: string, argent: ClientArgent, etat: EtatGestion = ETAT_SEPTEMBRE): void {
  render(
    <AppEnMemoire
      chemin={chemin}
      compte={clientMemoire({ utilisateur: CAMILLE })}
      gestion={clientGestionMemoire({ etat })}
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

describe('page Argent', () => {
  it('un clic depuis le menu : la phrase du mois, le bilan, la courbe des 12 mois, les montants de chaque bien liés à sa fiche', async () => {
    const utilisateur = userEvent.setup();
    monter('/gerer', clientArgentMemoire({ etat: { depenses: [TAXE], prets: [PRET] } }));
    const menu = await screen.findByRole('navigation', { name: 'Gérer' }, { timeout: 10_000 });
    await utilisateur.click(within(menu).getByRole('link', { name: 'Argent' }));

    // Septembre : 700 € encaissés, 840 € de taxe foncière, 1 071,19 € de mensualité.
    const titre = await screen.findByRole('heading', { level: 1 }, { timeout: 10_000 });
    expect(sansEspaces(titre.textContent)).toBe(
      'En septembre 2026, tes biens t’ont coûté 1 211,19 € après crédit.',
    );
    expect(screen.getByRole('list', { name: TEXTES_ARGENT.courbe }).children).toHaveLength(12);
    expect(
      screen.getByRole('link', { name: /^Loyers encaissés de T2 Lices : 700/ }),
    ).toHaveAttribute('href', '/gerer/biens/bien-lices');
    expect(
      screen.getByRole('link', { name: /^Cash-flow réel de Studio Baille : 0/ }),
    ).toHaveAttribute('href', '/gerer/biens/bien-baille');
  });

  it('filtre par bien, puis l’année : l’adresse garde le choix, « Par bien » disparaît avec le filtre', async () => {
    const utilisateur = userEvent.setup();
    monter('/gerer/argent', clientArgentMemoire({ etat: { depenses: [TAXE], prets: [PRET] } }));
    await utilisateur.click(
      await screen.findByRole('button', { name: /^Bien Tous les biens/ }, { timeout: 10_000 }),
    );
    await utilisateur.click(screen.getByRole('option', { name: 'Studio Baille' }));
    const titre = await screen.findByRole('heading', { level: 1 }, { timeout: 10_000 });
    expect(titre).toHaveTextContent('ne t’ont rien rapporté ni coûté');
    expect(screen.queryByRole('heading', { name: TEXTES_ARGENT.parBien })).not.toBeInTheDocument();

    await utilisateur.click(screen.getByRole('radio', { name: TEXTES_ARGENT.uneAnnee }));
    expect(
      await screen.findByRole('button', { name: /^Année 2026/ }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^En 2026/);
    expect(screen.getByRole('button', { name: /^Bien Studio Baille/ })).toBeInTheDocument();

    await utilisateur.click(screen.getByRole('button', { name: /^Année 2026/ }));
    await utilisateur.click(screen.getByRole('option', { name: '2025' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /^En 2025/ }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    await utilisateur.click(screen.getByRole('radio', { name: TEXTES_ARGENT.unMois }));
    await utilisateur.click(
      await screen.findByRole('button', { name: /^Mois Septembre 2026/ }, { timeout: 10_000 }),
    );
    await utilisateur.click(screen.getByRole('option', { name: 'Août 2026' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /^En août 2026/ }, { timeout: 10_000 }),
    ).toBeInTheDocument();
  });

  it('aucune dépense sur la période : la phrase le dit', async () => {
    monter('/gerer/argent?mois=2026-01', clientArgentMemoire());
    expect(
      await screen.findByText(TEXTES_ARGENT.aucuneDepense, {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
  });
});

describe('prêt du bien', () => {
  it('« À faire » propose le prêt de l’analyse ; deux clics : il est enregistré et sa mensualité s’affiche', async () => {
    const utilisateur = userEvent.setup();
    let clics = 0;
    const cliquer = async (element: HTMLElement): Promise<void> => {
      clics += 1;
      await utilisateur.click(element);
    };
    const argent = clientArgentMemoire();
    monter('/gerer', argent, ETAT_ACHETE);

    const aFaire = await screen.findByRole('list', { name: 'À faire' }, { timeout: 10_000 });
    await cliquer(within(aFaire).getByRole('link', { name: 'Enregistrer le prêt de T2 Lices' }));
    const pret = await screen.findByRole(
      'region',
      { name: TEXTES_PRET.titre },
      { timeout: 10_000 },
    );
    expect(pret).toHaveTextContent('L’analyse prévoyait');
    await cliquer(within(pret).getByRole('button', { name: TEXTES_PRET.enregistrerPropose }));

    expect(
      await within(pret).findByText(TEXTES_PRET.mensualite, {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(clics).toBe(2);
    expect(argent.donnees().prets).toEqual([
      expect.objectContaining({ bienId: 'bien-lices', debut: '2026-10' }),
    ]);
  });

  it('sans analyse : « Ajouter le prêt », saisie, « Enregistrer le prêt » ; puis « Modifier » et « Retirer le prêt »', async () => {
    const utilisateur = userEvent.setup();
    const argent = clientArgentMemoire();
    monter('/gerer/biens/bien-baille', argent);
    const pret = await screen.findByRole(
      'region',
      { name: TEXTES_PRET.titre },
      { timeout: 10_000 },
    );
    expect(pret).toHaveTextContent(TEXTES_PRET.aucun);
    await utilisateur.click(within(pret).getByRole('button', { name: TEXTES_PRET.ajouter }));

    const formulaire = within(pret).getByRole('form', { name: TEXTES_PRET.formulaire });
    await utilisateur.click(
      within(formulaire).getByRole('button', { name: TEXTES_PRET.enregistrer }),
    );
    expect(within(formulaire).getByLabelText(TEXTES_PRET.capital)).toHaveFocus();
    await utilisateur.type(within(formulaire).getByLabelText(TEXTES_PRET.capital), '12000');
    await utilisateur.type(within(formulaire).getByLabelText(TEXTES_PRET.taux), '12');
    await utilisateur.type(within(formulaire).getByLabelText(TEXTES_PRET.duree), '1');
    await utilisateur.click(
      within(formulaire).getByRole('button', { name: TEXTES_PRET.enregistrer }),
    );

    expect(
      await within(pret).findByText(TEXTES_PRET.restantDu, {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(sansEspaces(pret.textContent)).toContain('12 000 € à 12 % sur 1 an');
    expect(argent.donnees().prets[0]).toMatchObject({ capital: 1_200_000, debut: '2026-09' });

    await utilisateur.click(within(pret).getByRole('button', { name: TEXTES_PRET.modifier }));
    await utilisateur.click(within(pret).getByRole('button', { name: TEXTES_PRET.fermer }));
    await utilisateur.click(within(pret).getByRole('button', { name: TEXTES_PRET.modifier }));
    await utilisateur.click(within(pret).getByRole('button', { name: TEXTES_PRET.retirer }));
    expect(
      await within(pret).findByText(TEXTES_PRET.aucun, {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(argent.donnees().prets).toEqual([]);
  });

  it('« Ajuster avant » ouvre le prêt de l’analyse prérempli ; un refus de l’API s’affiche', async () => {
    const utilisateur = userEvent.setup();
    monter(
      '/gerer/biens/bien-lices',
      clientArgentMemoire({ erreurs: { enregistrerPret: 'reseau' } }),
      ETAT_ACHETE,
    );
    const pret = await screen.findByRole(
      'region',
      { name: TEXTES_PRET.titre },
      { timeout: 10_000 },
    );
    await utilisateur.click(within(pret).getByRole('button', { name: TEXTES_PRET.ajuster }));
    const formulaire = within(pret).getByRole('form', { name: TEXTES_PRET.formulaire });
    expect(within(formulaire).getByLabelText(TEXTES_PRET.premiereEcheance)).toHaveValue('10/2026');
    await utilisateur.click(
      within(formulaire).getByRole('button', { name: TEXTES_PRET.enregistrer }),
    );
    expect(await within(pret).findByRole('alert')).toHaveTextContent(
      'Impossible de joindre Deklic',
    );
  });
});
