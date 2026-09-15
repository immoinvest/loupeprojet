import { calculerProjet, projetExemple } from '@loupe/moteur';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { JSX } from 'react';
import { MemoryRouter, Route, Routes, useLocation, type InitialEntry } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import { ModeDocument } from '@/composants/document';
import { RetourEtEffet } from '@/ecrans/hypotheses/Retour';
import { appliquerSaisie, descripteurParChemin } from '@/hypotheses';
import { lireProjets } from '@/stockage/projets';

const n = (s: string | null | undefined): string => (s ?? '').replace(/\s/g, ' ');

const AVANT = calculerProjet(projetExemple);
const application = appliquerSaisie(
  projetExemple,
  descripteurParChemin('hypotheses.location.loyerHc'),
  '1300',
);
if (!application.ok) throw new Error(application.erreur);
const APRES = calculerProjet(application.projet);

const DEPUIS = {
  depuis: { pathname: '/projets/abc', origine: 'rapport', chemin: 'hypotheses.location.loyerHc' },
};

function Adresse(): JSX.Element {
  const { pathname } = useLocation();
  return <output aria-label="adresse">{pathname}</output>;
}

function monter(
  entrees: InitialEntry[],
  element: (r: typeof AVANT) => JSX.Element,
): { changer: (r: typeof AVANT) => void } {
  const arbre = (r: typeof AVANT): JSX.Element => (
    <MemoryRouter initialEntries={entrees} initialIndex={entrees.length - 1}>
      <Routes>
        <Route path="*" element={element(r)} />
      </Routes>
      <Adresse />
    </MemoryRouter>
  );
  const { rerender } = render(arbre(AVANT));
  return {
    changer: (r) => {
      rerender(arbre(r));
    },
  };
}

const lienVersHypotheses = {
  pathname: '/projets/abc/hypotheses',
  hash: '#hypotheses.location.loyerHc',
  state: DEPUIS,
};

describe('RetourEtEffet', () => {
  it('bandeau, puis effet de la modification ; « Revenir » passe par l’historique', async () => {
    const { changer } = monter(['/projets/abc', lienVersHypotheses], (r) => (
      <RetourEtEffet resultats={r} />
    ));
    expect(screen.getByRole('button', { name: 'Revenir à Rapport' })).toBeInTheDocument();
    const statut = screen.getByRole('status', { name: '' });
    expect(statut).toBeEmptyDOMElement();

    changer(APRES);
    expect(n(statut.textContent)).toContain(
      'Loyer visé, hors charges : 980 €/mois → 1 300 €/mois. Cash-flow : −210 €/mois → +91 €/mois.',
    );

    // Fermer le message le retire ; le bandeau reste.
    const utilisateur = userEvent.setup();
    await utilisateur.click(within(statut).getByRole('button', { name: 'Fermer' }));
    expect(statut).toBeEmptyDOMElement();

    await utilisateur.click(screen.getByRole('button', { name: 'Revenir à Rapport' }));
    expect(screen.getByRole('status', { name: 'adresse' })).toHaveTextContent('/projets/abc');
  });

  it('un rechargement sans entrée précédente revient à l’adresse d’origine', async () => {
    const { changer } = monter([lienVersHypotheses], (r) => <RetourEtEffet resultats={r} />);
    changer(APRES);
    const statut = screen.getAllByRole('status').find((s) => s.getAttribute('aria-label') === null);
    await userEvent
      .setup()
      .click(within(statut!).getByRole('button', { name: 'Revenir à Rapport' }));
    expect(screen.getByRole('status', { name: 'adresse' })).toHaveTextContent(/^\/projets\/abc$/);
  });

  it('rien sans origine, sur l’adresse d’origine ou sur papier', () => {
    monter(['/projets/abc/hypotheses'], (r) => <RetourEtEffet resultats={r} />);
    expect(screen.queryByRole('button')).toBeNull();
    cleanup();
    monter([{ pathname: '/projets/abc', state: DEPUIS }], (r) => <RetourEtEffet resultats={r} />);
    expect(screen.queryByRole('button')).toBeNull();
    cleanup();
    monter([lienVersHypotheses], (r) => (
      <ModeDocument>
        <RetourEtEffet resultats={r} />
      </ModeDocument>
    ));
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('Utilisé par', () => {
  it('Hypothèses : le prix affiché renvoie au Rapport, à Financement et à Revente', async () => {
    render(<AppEnMemoire chemin="/projets" />);
    await screen.findByRole('heading', { level: 1, name: 'Mes projets' });
    const id = lireProjets(window.localStorage)[0]?.id ?? '';
    cleanup();
    render(<AppEnMemoire chemin={`/projets/${id}/hypotheses`} />);
    await screen.findByRole('heading', { level: 1, name: 'Vos hypothèses' });
    const prix = document.querySelector<HTMLElement>('[data-champ="hypotheses.achat.prix"]')!;
    expect(n(prix.textContent)).toContain('Utilisé par :Rapport·Financement·Revente');
    expect(within(prix).getByRole('link', { name: 'Financement' })).toHaveAttribute(
      'href',
      `/projets/${id}/financement`,
    );
    // Un champ qu'aucun volet ne reprend : rien.
    const pieces = document.querySelector<HTMLElement>('[data-champ="bien.pieces"]')!;
    expect(pieces.textContent).not.toContain('Utilisé par');

    // Dans Financement, le volet courant n'est pas proposé.
    cleanup();
    render(<AppEnMemoire chemin={`/projets/${id}/financement`} />);
    await waitFor(() => {
      expect(document.querySelector('[data-champ="hypotheses.pret.apport"]')).not.toBeNull();
    });
    const apport = document.querySelector<HTMLElement>('[data-champ="hypotheses.pret.apport"]')!;
    expect(apport.textContent).not.toContain('Utilisé par');
    const taux = document.querySelector<HTMLElement>('[data-champ="hypotheses.pret.tauxNominal"]')!;
    expect(within(taux).getByRole('link', { name: 'Rapport' })).toHaveAttribute(
      'href',
      `/projets/${id}`,
    );
  });
});
