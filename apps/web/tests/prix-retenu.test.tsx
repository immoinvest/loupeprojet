import { projetExemple } from '@loupe/moteur';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import { creerProjet, ecrireProjets } from '@/stockage/projets';

const n = (s: string | null | undefined): string => (s ?? '').replace(/\s/g, ' ');

/** Le T3 Marseille enregistré avec une négociation, sous un identifiant connu. */
function amorcer(negociationTaux: number): void {
  ecrireProjets(window.localStorage, [
    creerProjet({
      nom: 'T3 à Marseille',
      genererId: () => 'negocie',
      source: {
        ...projetExemple,
        hypotheses: {
          ...projetExemple.hypotheses,
          achat: { ...projetExemple.hypotheses.achat, negociationTaux },
        },
      },
    }),
  ]);
}

const spanDisant =
  (debut: string) =>
  (_: string, element: Element | null): boolean =>
    element?.tagName === 'SPAN' && n(element.textContent).startsWith(debut);

describe('le prix retenu partout', () => {
  it('Rapport : la carte du prix dit le prix affiché, le prix retenu et la négociation', async () => {
    amorcer(0.05);
    render(<AppEnMemoire chemin="/projets/negocie" />);
    await screen.findByRole('heading', { name: /Le prix est bon/ });
    expect(n(screen.getByText(/^Prix affiché/).textContent)).toBe(
      'Prix affiché 155 000 € · retenu 147 250 € (−5 %)',
    );
    // En-tête du projet.
    expect(
      screen.getByText(spanDisant('147 250 € · négocié −5 % · meublé longue durée')),
    ).toBeInTheDocument();
    // La jauge place le prix au m² retenu (147 250 ÷ 65 = 2 265 €/m²).
    expect(screen.getByRole('img', { name: /Prix au m² 2.265/ })).toBeInTheDocument();
  });

  it('sans négociation : le prix affiché seul, aucune mention', async () => {
    amorcer(0);
    render(<AppEnMemoire chemin="/projets/negocie" />);
    await screen.findByRole('heading', { name: /Le prix est bon/ });
    expect(n(screen.getByText(/^Prix affiché/).textContent)).toBe('Prix affiché 155 000 €');
    expect(screen.queryByText(/négocié/)).toBeNull();
    expect(screen.getByText(spanDisant('155 000 € · meublé longue durée'))).toBeInTheDocument();
  });

  it('Mes projets et le document imprimé montrent le prix retenu', async () => {
    amorcer(0.05);
    render(<AppEnMemoire chemin="/projets" />);
    await screen.findByRole('heading', { name: 'Mes projets' });
    expect(screen.getByText(spanDisant('147 250 € · meublé longue durée'))).toBeInTheDocument();

    render(<AppEnMemoire chemin="/projets/negocie/imprimer" />);
    await screen.findByText(/dossier d'analyse locative/);
    expect(
      screen.getByText(spanDisant('147 250 € · négocié −5 % · meublé longue durée · 65 m²')),
    ).toBeInTheDocument();
  });
});
