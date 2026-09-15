import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { projetExemple } from '@loupe/moteur';

import { AppEnMemoire } from '@/App';
import { creerProjet, ecrireProjets, lireProjets } from '@/stockage/projets';

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
    expect(screen.getByText('le plus avantageux au total')).toBeInTheDocument();
    expect(n(screen.getAllByText(/26 928 €/)[0]?.textContent)).toContain('26 928 €');
    expect(
      // Amortissements déduits avant le déficit (CE, 15/04/2015) : réintégrés, ils créent 723 € d'impôt.
      screen.getByRole('img', { name: /0 années imposées sur 10, puis impôt à la revente/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Pas avant l'année 11/)).toBeInTheDocument();
    expect(screen.getByText(/taux à confirmer/)).toBeInTheDocument();
    const [revente, annuel] = screen.getAllByRole('table');
    expect(within(revente!).getAllByRole('row')).toHaveLength(12);
    expect(within(revente!).getAllByRole('columnheader')).toHaveLength(5);
    expect(within(annuel!).getAllByRole('row')).toHaveLength(11);
    expect(screen.getAllByRole('button', { name: 'Retenir ce régime' })).toHaveLength(3);
  });

  it('chaque régime dit son impôt pendant la location, à la revente et au total', async () => {
    // L'exemple revalorisé de 3 % par an : une plus-value existe à 10 ans, et les amortissements
    // réintégrés du meublé au réel l'augmentent.
    const p = creerProjet({
      nom: 'T3 revalorisé',
      genererId: () => 'revalorise',
      source: {
        ...projetExemple,
        hypotheses: {
          ...projetExemple.hypotheses,
          revente: { ...projetExemple.hypotheses.revente, evolutionAnnuelle: 0.03 },
        },
      },
    });
    ecrireProjets(window.localStorage, [p]);
    render(<AppEnMemoire chemin={`/projets/${p.id}/fiscalite`} />);
    await screen.findByRole('heading', { name: /Combien d'impôts/ });
    const carteReel = screen.getByRole('heading', { name: 'Meublé au réel' }).closest('section')!;
    const carteMicro = screen
      .getByRole('heading', { name: 'Meublé micro-BIC' })
      .closest('section')!;
    for (const carte of [carteReel, carteMicro]) {
      expect(within(carte).getByText('Pendant 10 ans')).toBeInTheDocument();
      expect(within(carte).getByText('À la revente')).toBeInTheDocument();
      expect(within(carte).getByText('Impôt total')).toBeInTheDocument();
      expect(within(carte).getByText(/Ce qu'il vous reste au total/)).toBeInTheDocument();
    }
    // Le meublé au réel paie à la revente l'impôt de ses amortissements réintégrés ; le micro-BIC non.
    expect(within(carteReel).getByText(/dus aux amortissements réintégrés/)).toBeInTheDocument();
    expect(n(within(carteReel).getByText(/s'ajoutent à la revente/).textContent)).toContain(
      'résidence services',
    );
    expect(within(carteMicro).queryByText(/dus aux amortissements réintégrés/)).toBeNull();
    expect(
      screen.getByRole('heading', { name: 'Pendant la location et à la revente' }),
    ).toBeInTheDocument();
    // L'horizon mène à son curseur dans Revente (lien d'hypothèse).
    expect(screen.getByRole('link', { name: /^\d+ ans — modifier Revente dans$/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/projets\/[^/]+\/revente#hypotheses\.revente\.annees$/),
    );
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
    expect(
      screen.getByRole('img', { name: /10 années imposées sur 10, sans impôt à la revente/ }),
    ).toBeInTheDocument();
  });
});

describe('Revente', () => {
  const anneesEnregistrees = (): number | undefined =>
    lireProjets(window.localStorage)[0]?.projet.hypotheses.revente.annees;

  it('ouvre sur le curseur à 10 ans, le taux de la plus-value, quatre repères et le détail', async () => {
    await ouvrir('revente');
    await screen.findByRole('heading', { name: /Qu'est-ce qu'il vous restera/ });
    const curseur = screen.getByRole('slider', { name: 'Revente dans' });
    expect(curseur).toHaveValue('10');
    expect(curseur).toHaveAttribute('min', '1');
    expect(curseur).toHaveAttribute('max', '30');
    expect(curseur).toHaveAttribute('aria-valuetext', 'Dans 10 ans');
    expect(screen.getByText('10 ans')).toBeInTheDocument();
    // Taux global lu dans les règles : IR après 30 % d'abattement, PS après 8,25 %.
    expect(n(screen.getByText(/Plus-value imposée à/).textContent)).toContain(
      "29,1 % à 10 ans : impôt sur le revenu après 30 % d'abattement, prélèvements sociaux après 8,25 %",
    );
    expect(
      screen.getByText(
        "22 ans : plus d'impôt sur le revenu · 30 ans : plus de prélèvements sociaux",
      ),
    ).toBeInTheDocument();
    const reperes = within(screen.getByRole('group', { name: 'Horizons repères' })).getAllByRole(
      'button',
    );
    expect(reperes.map((b) => /^Dans \d+ ans/.exec(b.textContent)?.[0])).toEqual([
      'Dans 5 ans',
      'Dans 10 ans',
      'Dans 15 ans',
      'Dans 20 ans',
    ]);
    expect(reperes[1]).toHaveAttribute('aria-pressed', 'true');
    expect(n(screen.getAllByText(/57 493 €/)[0]?.textContent)).toContain('57 493 €');
    expect(screen.getByRole('heading', { name: 'Revente dans 10 ans' })).toBeInTheDocument();
    // 19 486 € d'amortissements du bâti réintégrés, prix de l'acte 148 000 € : plus-value brute 2 487 €.
    expect(screen.getByText('amortissements réintégrés (réforme 2025)')).toBeInTheDocument();
    expect(screen.getByText('2 487 €')).toBeInTheDocument();
    expect(
      screen.getByText("Prix d'achat dans l'acte, hors honoraires de l'acquéreur"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Ce qu'il vous reste en poche/)).toBeInTheDocument();
  });

  it('pendant le glissement les chiffres suivent sans écrire ; le relâchement enregistre', async () => {
    await ouvrir('revente');
    await screen.findByRole('heading', { name: /Qu'est-ce qu'il vous restera/ });
    const curseur = screen.getByRole('slider', { name: 'Revente dans' });

    fireEvent.input(curseur, { target: { value: '20' } });
    expect(curseur).toHaveValue('20');
    expect(screen.getByRole('heading', { name: 'Revente dans 20 ans' })).toBeInTheDocument();
    expect(screen.getByText('Cash-flows cumulés sur 20 ans')).toBeInTheDocument();
    expect(n(screen.getAllByText(/144 801 €/)[0]?.textContent)).toContain('144 801 €');
    expect(screen.getByRole('button', { name: /Dans 20 ans/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(anneesEnregistrees()).toBe(10);

    fireEvent(curseur, new Event('change', { bubbles: true }));
    expect(anneesEnregistrees()).toBe(20);
    expect(lireProjets(window.localStorage)[0]?.projet.provenance['revente.annees']).toBe(
      'utilisateur',
    );
    expect(screen.getByRole('heading', { name: 'Revente dans 20 ans' })).toBeInTheDocument();
    expect(curseur).toHaveValue('20');
  });

  it('sans relâchement, enregistre 150 ms après le dernier mouvement', async () => {
    await ouvrir('revente');
    await screen.findByRole('heading', { name: /Qu'est-ce qu'il vous restera/ });
    const curseur = screen.getByRole('slider', { name: 'Revente dans' });
    fireEvent.input(curseur, { target: { value: '14' } });
    fireEvent.input(curseur, { target: { value: '15' } });
    expect(anneesEnregistrees()).toBe(10);
    await waitFor(() => {
      expect(anneesEnregistrees()).toBe(15);
    });
    expect(screen.getByRole('heading', { name: 'Revente dans 15 ans' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dans 15 ans/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('se règle au clavier, et un horizon hors des repères ne marque aucune carte', async () => {
    await ouvrir('revente');
    await screen.findByRole('heading', { name: /Qu'est-ce qu'il vous restera/ });
    const utilisateur = userEvent.setup();
    const curseur = screen.getByRole('slider', { name: 'Revente dans' });
    curseur.focus();
    await utilisateur.keyboard('{ArrowRight}{ArrowRight}');
    expect(curseur).toHaveValue('12');
    expect(anneesEnregistrees()).toBe(12);
    expect(screen.getByRole('heading', { name: 'Revente dans 12 ans' })).toBeInTheDocument();
    expect(screen.getByText('TRI sur 12 ans')).toBeInTheDocument();
    for (const bouton of screen.getAllByRole('button', { pressed: true })) {
      expect(bouton).not.toHaveTextContent(/Dans \d+ ans/);
    }
    expect(n(screen.getByText(/Plus-value imposée à/).textContent)).toContain('à 12 ans');
  });

  it('cliquer un repère enregistre la durée de détention et règle le curseur', async () => {
    await ouvrir('revente');
    await screen.findByRole('heading', { name: /Qu'est-ce qu'il vous restera/ });
    const utilisateur = userEvent.setup();
    await utilisateur.click(screen.getByRole('button', { name: /Dans 20 ans/ }));
    expect(anneesEnregistrees()).toBe(20);
    expect(screen.getByRole('heading', { name: 'Revente dans 20 ans' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Revente dans' })).toHaveValue('20');
    expect(screen.getByRole('button', { name: /Dans 20 ans/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Recliquer l'horizon courant n'écrit rien de plus.
    const ecriture = vi.spyOn(Storage.prototype, 'setItem');
    await utilisateur.click(screen.getByRole('button', { name: /Dans 20 ans/ }));
    expect(ecriture).not.toHaveBeenCalled();
    ecriture.mockRestore();
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
  it('liste les questions par catégorie et enregistre une réponse avec le projet', async () => {
    await ouvrir('visite');
    await screen.findByRole('heading', { name: 'Préparer la visite' });
    expect(screen.getByRole('heading', { name: 'Documents à demander' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sur place, le logement' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Exploitation locative' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: "À régler avant l'offre" }),
    ).not.toBeInTheDocument();
    const ok = screen.getAllByRole('radio', { name: 'OK' });
    expect(ok.length).toBeGreaterThanOrEqual(40);
    expect(screen.getByText(/0 sur \d+ répondues/)).toBeInTheDocument();
    const utilisateur = userEvent.setup();
    await utilisateur.click(ok[0]!);
    expect(screen.getByText(/^1 sur \d+ répondue$/)).toBeInTheDocument();
    expect(Object.keys(lireProjets(window.localStorage)[0]?.visite?.reponses ?? {})).toHaveLength(
      1,
    );
    expect(screen.getByRole('link', { name: 'vos hypothèses' })).toBeInTheDocument();
  });
});
