import type { EtatGestion } from '@loupe/gestion';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientMemoire } from '@/compte/memoire';
import type { Utilisateur } from '@/compte/types';
import { montant } from '@/gestion/format';
import { clientGestionMemoire } from '@/gestion/memoire';
import type { ClientGestion } from '@/gestion/types';
import { TEXTES_DOCUMENT as D } from '@/textes/gerer-documents';
import { TEXTES_FICHE as F } from '@/textes/gerer-fiche';
import { plusApl } from '@/textes/gerer-loyers';
import { TEXTES_AJOUTER as A } from '@/textes/gerer-saisie';

import { BAILLEUR, ETAT_SEPTEMBRE, LOCATION_ANTOINE, LOCATION_JULIE } from './gestion-exemples';

const CAMILLE: Utilisateur = {
  id: 'u1',
  nom: 'Camille Roux',
  email: 'camille@example.org',
  image: null,
};

/** Julie touche 180 € d'APL versés au bailleur ; son loyer de septembre est reçu. */
const ETAT_APL: EtatGestion = {
  ...ETAT_SEPTEMBRE,
  bailleur: BAILLEUR,
  locations: [{ ...LOCATION_JULIE, apl: 18_000 }, LOCATION_ANTOINE],
};

function monter(gestion: ClientGestion, chemin: string): void {
  render(
    <AppEnMemoire
      chemin={chemin}
      compte={clientMemoire({ utilisateur: CAMILLE })}
      gestion={gestion}
    />,
  );
}

/** Un montant tel que le texte normalisé de la page l'écrit (espace fine insécable → espace). */
function normal(texte: string): string {
  return texte.replace(/\s/g, ' ');
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('APL versée au bailleur, à l’écran', () => {
  it('la ligne du loyer : la part du locataire, puis l’aide', async () => {
    monter(clientGestionMemoire({ etat: ETAT_APL }), '/gerer');
    const lien = await screen.findByRole('link', { name: 'T2 Lices' }, { timeout: 10_000 });
    const ligne = lien.closest('li');
    if (ligne === null) throw new Error('ligne du loyer absente');
    expect(within(ligne).getByText(normal(montant(52_000)))).toBeInTheDocument();
    expect(within(ligne).getByText(normal(plusApl(18_000)))).toBeInTheDocument();
  });

  it('la sortie rappelle la CAF ; la quittance distingue l’aide ; l’aperçu signale la mention à confirmer', async () => {
    const utilisateur = userEvent.setup();
    monter(clientGestionMemoire({ etat: ETAT_APL }), '/gerer/biens/bien-lices');
    await utilisateur.click(
      await screen.findByRole('button', { name: F.terminer }, { timeout: 10_000 }),
    );
    expect(screen.getByText(F.rappelCaf)).toBeInTheDocument();

    await utilisateur.click(screen.getByRole('button', { name: 'Quittance' }));
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'Quittance de loyer' },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: D.apl })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: D.partLocataire })).toBeInTheDocument();
    expect(screen.getByText(D.aplAConfirmer)).toBeInTheDocument();
  });

  it('sans aide : aucun rappel de la CAF à la sortie', async () => {
    const utilisateur = userEvent.setup();
    monter(clientGestionMemoire({ etat: ETAT_APL }), '/gerer/biens/bien-baille');
    await utilisateur.click(
      await screen.findByRole('button', { name: F.terminer }, { timeout: 10_000 }),
    );
    expect(screen.queryByText(F.rappelCaf)).toBeNull();
  });

  it('« Ajouter à la main » : l’APL de « Plus de détails » part avec la location', async () => {
    const utilisateur = userEvent.setup();
    const gestion = clientGestionMemoire();
    monter(gestion, '/gerer/ajouter');
    await utilisateur.type(
      await screen.findByLabelText(A.adresse, {}, { timeout: 10_000 }),
      '12 rue des Lices, Marseille',
    );
    await utilisateur.type(screen.getByLabelText(A.loyer), '650');
    await utilisateur.type(screen.getByLabelText(A.charges), '50');
    await utilisateur.type(screen.getByLabelText(A.locataire), 'Julie Martin');
    await utilisateur.click(screen.getByText(A.plusDeDetails));
    await utilisateur.type(screen.getByLabelText(A.apl), '180');
    await utilisateur.click(screen.getByRole('button', { name: A.creer }));

    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: '0 loyer sur 1 reçu' },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument();
    expect(gestion.donnees().locations[0]?.apl).toBe(18_000);
  });
});
