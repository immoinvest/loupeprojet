import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import { lireProjets } from '@/stockage/projets';

const n = (s: string | null | undefined): string => (s ?? '').replace(/\s/g, ' ');

async function ouvrir(onglet: 'fiscalite' | 'revente' | 'visite'): Promise<void> {
  render(<AppEnMemoire chemin="/projets" />);
  await screen.findByRole('heading', { name: 'Mes projets' });
  const id = lireProjets(window.localStorage)[0]?.id ?? '';
  render(<AppEnMemoire chemin={`/projets/${id}/${onglet}`} />);
}

describe('Fiscalité', () => {
  it('montre les quatre régimes, le retenu, le meilleur, la frise et le tableau annuel', async () => {
    await ouvrir('fiscalite');
    await screen.findByRole('heading', { name: /Combien d'impôts/ });
    expect(screen.getByRole('heading', { name: 'Meublé au réel' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Meublé micro-BIC' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nu au réel' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nu micro-foncier' })).toBeInTheDocument();
    expect(screen.getByText('retenu')).toBeInTheDocument();
    expect(screen.getByText('meilleur cash-flow')).toBeInTheDocument();
    expect(n(screen.getByText(/26 928 €/).textContent)).toContain('26 928 €');
    expect(screen.getByRole('img', { name: /0 années imposées sur 10/ })).toBeInTheDocument();
    expect(screen.getByText(/Pas avant l'année 11/)).toBeInTheDocument();
    expect(screen.getByText(/taux à confirmer/)).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(11);
    expect(screen.getAllByRole('button', { name: 'Retenir ce régime' })).toHaveLength(3);
  });

  it('« Retenir ce régime » change le régime du projet', async () => {
    await ouvrir('fiscalite');
    await screen.findByRole('heading', { name: /Combien d'impôts/ });
    const utilisateur = userEvent.setup();
    const carteMicro = screen.getByRole('heading', { name: 'Meublé micro-BIC' }).closest('section');
    expect(carteMicro).not.toBeNull();
    await utilisateur.click(within(carteMicro!).getByRole('button', { name: 'Retenir ce régime' }));
    expect(lireProjets(window.localStorage)[0]?.projet.hypotheses.fiscalite.regime).toBe(
      'micro_bic',
    );
    expect(lireProjets(window.localStorage)[0]?.projet.provenance['fiscalite.regime']).toBe(
      'utilisateur',
    );
    expect(screen.getByText(/Premier impôt l'année 1/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /10 années imposées sur 10/ })).toBeInTheDocument();
  });
});

describe('Revente', () => {
  it('propose quatre horizons, détaille la revente et la plus-value', async () => {
    await ouvrir('revente');
    await screen.findByRole('heading', { name: /Qu'est-ce qu'il vous restera/ });
    const horizons = within(screen.getByRole('group', { name: 'Horizon de revente' })).getAllByRole(
      'button',
    );
    expect(horizons).toHaveLength(4);
    expect(horizons[1]).toHaveAttribute('aria-pressed', 'true');
    expect(n(screen.getAllByText(/58 217 €/)[0]?.textContent)).toContain('58 217 €');
    expect(screen.getByText(/Pas de plus-value imposable/)).toBeInTheDocument();
    expect(screen.getByText(/Ce qu'il vous reste en poche/)).toBeInTheDocument();
  });

  it('cliquer un horizon enregistre la durée de détention et recalcule', async () => {
    await ouvrir('revente');
    await screen.findByRole('heading', { name: /Qu'est-ce qu'il vous restera/ });
    const utilisateur = userEvent.setup();
    await utilisateur.click(screen.getByRole('button', { name: /Dans 20 ans/ }));
    expect(lireProjets(window.localStorage)[0]?.projet.hypotheses.revente.annees).toBe(20);
    expect(screen.getByRole('heading', { name: 'Revente dans 20 ans' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dans 20 ans/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('affiche le détail quand il y a une plus-value imposable', async () => {
    render(<AppEnMemoire chemin="/projets" />);
    await screen.findByRole('heading', { name: 'Mes projets' });
    const id = lireProjets(window.localStorage)[0]?.id ?? '';
    render(<AppEnMemoire chemin={`/projets/${id}/hypotheses`} />);
    await screen.findByRole('heading', { name: 'Vos hypothèses' });
    const utilisateur = userEvent.setup();
    const evolution = screen.getByLabelText(/Évolution du prix/);
    await utilisateur.clear(evolution);
    await utilisateur.type(evolution, '6');
    expect(lireProjets(window.localStorage)[0]?.projet.hypotheses.revente.evolutionAnnuelle).toBe(
      0.06,
    );
    render(<AppEnMemoire chemin={`/projets/${id}/revente`} />);
    await screen.findByRole('heading', { name: /Qu'est-ce qu'il vous restera/ });
    expect(screen.getByText('Plus-value brute')).toBeInTheDocument();
    expect(screen.getByText(/amortissements réintégrés/)).toBeInTheDocument();
    expect(screen.getByText(/Impôt sur le revenu, 19 %/)).toBeInTheDocument();
  });
});

describe('Visite', () => {
  it('liste les points par catégorie et compte les cases cochées', async () => {
    await ouvrir('visite');
    await screen.findByRole('heading', { name: 'Préparer la visite' });
    expect(screen.getByRole('heading', { name: 'Documents à demander' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'À vérifier sur place' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "À régler avant l'offre" })).toBeInTheDocument();
    const cases = screen.getAllByRole('checkbox');
    expect(cases).toHaveLength(7);
    expect(screen.getByText(/0 sur 7 vérifiés/)).toBeInTheDocument();
    const utilisateur = userEvent.setup();
    await utilisateur.click(cases[0]!);
    expect(screen.getByText(/1 sur 7 vérifiés/)).toBeInTheDocument();
    await utilisateur.click(cases[0]!);
    expect(screen.getByText(/0 sur 7 vérifiés/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'vos hypothèses' })).toBeInTheDocument();
  });
});
