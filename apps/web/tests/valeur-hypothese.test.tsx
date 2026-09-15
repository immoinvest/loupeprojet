import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { JSX } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { ModeDocument } from '@/composants/document';
import { ValeurHypothese } from '@/composants/ValeurHypothese';

/** Affiche l'adresse courante et l'origine portée par l'état, pour vérifier la navigation. */
function Adresse(): JSX.Element {
  const location = useLocation();
  const { pathname, hash } = location;
  const state: unknown = location.state;
  return <output aria-label="adresse">{`${pathname}${hash} ${JSON.stringify(state)}`}</output>;
}

function monter(chemin: string, page: JSX.Element): void {
  render(
    <MemoryRouter initialEntries={[chemin]}>
      <Routes>
        <Route path="/projets/:id" element={page} />
        <Route path="/projets/:id/:volet" element={page} />
        <Route path="/comparer" element={page} />
      </Routes>
      <Adresse />
    </MemoryRouter>,
  );
}

const adresse = (): string => screen.getByRole('status', { name: 'adresse' }).textContent;

describe('ValeurHypothese', () => {
  it('un lien vers le volet qui porte le champ, avec l’origine ; le texte visible ne change pas', async () => {
    monter(
      '/projets/abc',
      <ValeurHypothese chemin="hypotheses.pret.tauxNominal">3,35 %</ValeurHypothese>,
    );
    const lien = screen.getByRole('link', { name: '3,35 % — modifier Taux nominal' });
    expect(lien).toHaveTextContent(/^3,35 %$/);
    expect(lien).toHaveAttribute('href', '/projets/abc/financement#hypotheses.pret.tauxNominal');

    await userEvent.setup().click(lien);
    expect(adresse()).toBe(
      '/projets/abc/financement#hypotheses.pret.tauxNominal {"depuis":{"pathname":"/projets/abc","origine":"rapport","chemin":"hypotheses.pret.tauxNominal"}}',
    );
  });

  it('sur place : le champ affiché dans la page reçoit le focus, l’adresse ne change pas', async () => {
    monter(
      '/projets/abc/financement',
      <main>
        <ValeurHypothese chemin="hypotheses.pret.apport">15 000 €</ValeurHypothese>
        <div data-champ="hypotheses.pret.apport">
          <input aria-label="Apport" />
        </div>
      </main>,
    );
    await userEvent.setup().click(screen.getByRole('link', { name: /modifier Apport/ }));
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Apport' }));
    expect(screen.getByRole('textbox', { name: 'Apport' }).parentElement).toHaveClass(
      'mise-en-evidence',
    );
    expect(adresse()).toBe('/projets/abc/financement null');
  });

  it('Comparer : le lien vise le projet de la colonne, jamais sur place', async () => {
    monter(
      '/comparer',
      <main>
        <ValeurHypothese chemin="hypotheses.achat.prix" projetId="xyz">
          155 000 €
        </ValeurHypothese>
        <div data-champ="hypotheses.achat.prix">
          <input aria-label="Prix" />
        </div>
      </main>,
    );
    await userEvent.setup().click(screen.getByRole('link', { name: /modifier Prix affiché/ }));
    expect(adresse()).toMatch(
      /^\/projets\/xyz\/hypotheses#hypotheses\.achat\.prix .*"origine":"comparer"/,
    );
  });

  it('hors d’un projet et sans origine connue : pas d’état ; sans projet : le texte seul', () => {
    monter(
      '/projets/abc/imprimer',
      <ValeurHypothese chemin="hypotheses.achat.prix">155 000 €</ValeurHypothese>,
    );
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/projets/abc/hypotheses#hypotheses.achat.prix',
    );
  });

  it('dans un document : la valeur sans lien', () => {
    monter(
      '/projets/abc',
      <ModeDocument>
        <ValeurHypothese chemin="hypotheses.achat.prix">155 000 €</ValeurHypothese>
      </ModeDocument>,
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('155 000 €')).toBeInTheDocument();
  });

  it('Comparer sans projet : le texte seul', () => {
    monter(
      '/comparer',
      <ValeurHypothese chemin="hypotheses.achat.prix">155 000 €</ValeurHypothese>,
    );
    expect(screen.queryByRole('link')).toBeNull();
  });
});
