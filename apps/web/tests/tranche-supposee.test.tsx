import { projetExemple } from '@loupe/moteur';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import { creerProjet, ecrireProjets, lireProjets } from '@/stockage/projets';

const n = (s: string | null | undefined): string => (s ?? '').replace(/\s/g, ' ');

/** Le projet d'exemple dont la tranche vient d'un défaut (provenance « estime »), ou non. */
function amorcer(estimee: boolean): string {
  const p = creerProjet({
    nom: 'T3 tranche',
    genererId: () => 'tranche',
    source: {
      ...projetExemple,
      provenance: {
        ...projetExemple.provenance,
        ...(estimee ? { 'fiscalite.tmi': 'estime' } : {}),
      },
    },
  });
  ecrireProjets(window.localStorage, [p]);
  return p.id;
}

describe('tranche d’imposition supposée', () => {
  it('Fiscalité dit « supposée », propose le choix, et un choix recalcule les impôts', async () => {
    const id = amorcer(true);
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin={`/projets/${id}/fiscalite`} />);
    await screen.findByRole('heading', { name: /Combien d'impôts, selon le régime/ });
    expect(screen.getByRole('heading', { name: "Votre tranche d'imposition" })).toBeInTheDocument();
    expect(n(screen.getAllByText(/26 928 €/)[0]?.textContent)).toContain('26 928 €');

    await utilisateur.click(
      within(screen.getByRole('radiogroup', { name: /Tranche d'imposition/ })).getByRole('radio', {
        name: '41 %',
      }),
    );

    const enregistre = lireProjets(window.localStorage)[0]?.projet;
    expect(enregistre?.hypotheses.fiscalite.tmi).toBe(0.41);
    expect(enregistre?.provenance['fiscalite.tmi']).toBe('utilisateur');
    expect(
      screen.queryByRole('heading', { name: "Votre tranche d'imposition" }),
    ).not.toBeInTheDocument();
    expect(screen.queryAllByText(/26 928 €/)).toHaveLength(0);
  });

  it('Rapport : la carte des impôts mentionne la tranche supposée', async () => {
    const id = amorcer(true);
    render(<AppEnMemoire chemin={`/projets/${id}`} />);
    await screen.findByRole('heading', { name: /Le prix est bon/ });
    // Le régime et la tranche sont des liens d'hypothèse : la phrase se lit sur tout le paragraphe.
    const phrase = screen.getByText(/Tranche supposée à/).closest('p');
    expect(phrase?.textContent.replace(/\s/g, ' ')).toContain(
      'Meublé au réel. Tranche supposée à 30 %.',
    );
  });

  it('tranche choisie : ni mention ni encart', async () => {
    const id = amorcer(false);
    render(<AppEnMemoire chemin={`/projets/${id}/fiscalite`} />);
    await screen.findByRole('heading', { name: /Combien d'impôts, selon le régime/ });
    expect(
      screen.queryByRole('heading', { name: "Votre tranche d'imposition" }),
    ).not.toBeInTheDocument();
  });

  it('impression : la mention reste, l’encart disparaît', async () => {
    const id = amorcer(true);
    render(<AppEnMemoire chemin={`/projets/${id}/imprimer`} />);
    expect(await screen.findByText(/dossier d'analyse locative/)).toBeInTheDocument();
    expect(n(screen.getByText(/Meublé au réel\./).textContent)).toContain(
      'Tranche supposée à 30 %.',
    );
    expect(
      screen.queryByRole('heading', { name: "Votre tranche d'imposition" }),
    ).not.toBeInTheDocument();
  });
});
