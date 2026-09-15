import { projetExemple, type ProjetEntree } from '@loupe/moteur';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import { creerProjet, ecrireProjets, lireProjets } from '@/stockage/projets';

/** Ouvre une adresse du projet d'exemple (créé au premier lancement). */
async function ouvrirExemple(suite: string): Promise<string> {
  render(<AppEnMemoire chemin="/projets" />);
  await screen.findByRole('heading', { level: 1, name: 'Mes projets' });
  const id = lireProjets(window.localStorage)[0]?.id ?? '';
  cleanup();
  render(<AppEnMemoire chemin={`/projets/${id}${suite}`} />);
  return id;
}

function saisieDuChamp(chemin: string): HTMLElement {
  // La saisie, pas l'icône ⓘ du libellé qui la précède.
  const saisie = document.querySelector<HTMLElement>(
    `[data-champ="${chemin}"] :is(input, select, textarea)`,
  );
  if (saisie === null) throw new Error(`champ ${chemin} absent`);
  return saisie;
}

describe('un fragment ouvre le champ visé', () => {
  it('Hypothèses#loyer : focus sur le loyer', async () => {
    await ouvrirExemple('/hypotheses#hypotheses.location.loyerHc');
    await screen.findByRole('heading', { level: 1, name: 'Vos hypothèses' }, { timeout: 5000 });
    const loyer = screen.getByLabelText('Loyer visé, hors charges');
    // La mise en évidence ne dure que 2 s : sous charge, elle peut être finie quand on regarde.
    // Elle est vérifiée sans délai dans valeur-hypothese.test.tsx (même fonction montrerChamp).
    await waitFor(
      () => {
        expect(document.activeElement).toBe(loyer);
      },
      { timeout: 5000 },
    );
  });

  it('un champ replié (travaux) : le dépliant s’ouvre et le champ a le focus', async () => {
    await ouvrirExemple('/hypotheses#hypotheses.achat.travaux');
    await screen.findByRole('heading', { level: 1, name: 'Vos hypothèses' });
    await waitFor(() => {
      expect(document.activeElement).toBe(saisieDuChamp('hypotheses.achat.travaux'));
    });
  });

  it('le prêt dans Financement, l’horizon sur le curseur de Revente', async () => {
    const id = await ouvrirExemple('/financement#hypotheses.pret.tauxNominal');
    await waitFor(() => {
      expect(document.activeElement).toBe(saisieDuChamp('hypotheses.pret.tauxNominal'));
    });
    cleanup();
    render(<AppEnMemoire chemin={`/projets/${id}/revente#hypotheses.revente.annees`} />);
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('slider', { name: 'Revente dans' }));
    });
  });

  it('un fragment inconnu ne fait rien', async () => {
    await ouvrirExemple('/hypotheses#n-importe-quoi');
    await screen.findByRole('heading', { level: 1, name: 'Vos hypothèses' });
    expect(document.querySelector('.mise-en-evidence')).toBeNull();
  });

  it('champ absent du volet (Revente sans loyer) : Hypothèses au même champ', async () => {
    const source = {
      ...projetExemple,
      hypotheses: {
        ...projetExemple.hypotheses,
        location: { ...projetExemple.hypotheses.location, loyerHc: undefined },
      },
    } as ProjetEntree;
    const enregistre = creerProjet({ source });
    ecrireProjets(window.localStorage, [enregistre]);
    render(<AppEnMemoire chemin={`/projets/${enregistre.id}/revente#hypotheses.revente.annees`} />);
    // Deux étapes asynchrones (un rendu, puis la navigation) : délai large sous charge.
    await screen.findByRole('heading', { level: 1, name: 'Vos hypothèses' }, { timeout: 5000 });
    await waitFor(
      () => {
        expect(document.activeElement).toBe(saisieDuChamp('hypotheses.revente.annees'));
      },
      { timeout: 5000 },
    );
  });
});
