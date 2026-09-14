import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import { creerProjet, ecrireProjets } from '@/stockage/projets';

const n = (s: string | null | undefined): string => (s ?? '').replace(/\s/g, ' ');

/** Le projet d'exemple enregistré sous un identifiant connu, puis son rapport ouvert. */
async function ouvrirRapport(chemin = ''): Promise<void> {
  const p = creerProjet({ nom: 'T3 · 65 m² · Marseille 5e', genererId: () => 'exemple' });
  ecrireProjets(window.localStorage, [p]);
  render(<AppEnMemoire chemin={`/projets/exemple${chemin}`} />);
  await screen.findByRole('heading', { level: 1, name: /Le prix est bon/ });
}

/** La carte (section) dont le titre de niveau 2 est `titre`. */
function carte(titre: string): HTMLElement {
  const section = screen.getByRole('heading', { level: 2, name: titre }).closest('section');
  expect(section).not.toBeNull();
  return section!;
}

describe('Rapport : autofinancement au centre', () => {
  it('la première carte est l’autofinancement, avec la cascade du loyer au reste après impôt', async () => {
    await ouvrirRapport();
    const titres = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titres.slice(0, 3)).toEqual([
      "Est-ce que ça s'autofinance ?",
      "Est-ce que c'est cher ?",
      'Combien ça rapporte ?',
    ]);

    const c = carte("Est-ce que ça s'autofinance ?");
    expect(within(c).getByText('Non.')).toBeInTheDocument();
    // La cascade : le conteneur des lignes, repéré par sa première ligne « Loyer ».
    const cascade = within(c).getByText('Loyer').closest('div')!.parentElement!;
    const lignes = [...cascade.children].map((l) => n(l.textContent));
    expect(lignes).toEqual([
      'Loyer+980 €',
      'Crédit et assurance−827 €',
      '= Après le crédit+153 €',
      'Charges, impôts locaux, entretien−307 €',
      '3 semaines vides par an−57 €',
      'Reste chaque mois−210 €',
      'ImpôtMeublé au réel, moyenne sur 10 ans0 €',
      "= Après l'impôt−210 €",
    ]);
  });

  it('montre les trois repères : couverture, effort d’épargne, loyer d’équilibre', async () => {
    await ouvrirRapport();
    const c = carte("Est-ce que ça s'autofinance ?");
    expect(within(c).getByText('Part du loyer prise par le crédit')).toBeInTheDocument();
    expect(n(within(c).getByText('84 %').textContent)).toBe('84 %');
    expect(n(within(c).getByText(/827 € de mensualité pour 980 € de loyer/).textContent)).toContain(
      '980 €',
    );
    expect(within(c).getByText("Effort d'épargne")).toBeInTheDocument();
    expect(n(within(c).getByText(/210 €\/mois/).textContent)).toBe('210 €/mois');
    expect(within(c).getByText('à sortir de votre poche')).toBeInTheDocument();
    expect(within(c).getByText("Loyer d'équilibre")).toBeInTheDocument();
    expect(n(within(c).getByText('1 203 €', { selector: 'span' }).textContent)).toBe('1 203 €');
    expect(n(within(c).getByText(/pour un cash-flow à zéro/).textContent)).toContain('980 € visés');
  });

  it('chaque icône ouvre une bulle avec les chiffres du projet', async () => {
    await ouvrirRapport();
    const utilisateur = userEvent.setup();
    const c = carte("Est-ce que ça s'autofinance ?");
    const icones = within(c).getAllByRole('button', { name: /^Explication : / });
    expect(icones.map((b) => b.getAttribute('aria-label'))).toEqual([
      "Explication : Est-ce que ça s'autofinance ?",
      'Explication : Part du loyer prise par le crédit',
      "Explication : Effort d'épargne",
      "Explication : Loyer d'équilibre",
    ]);
    await utilisateur.click(icones[1]!);
    const bulle = within(c).getByRole('tooltip', { hidden: false });
    expect(bulle).toBeVisible();
    expect(n(bulle.textContent)).toContain('représente 84 % du loyer (980 €)');
    await utilisateur.keyboard('{Escape}');
    expect(bulle).not.toBeVisible();
  });

  it('la carte Rendements montre brut, net et net-net avec leurs définitions', async () => {
    await ouvrirRapport();
    const c = carte('Combien ça rapporte ?');
    expect(n(within(c).getByText('6,8 %').textContent)).toBe('6,8 %');
    expect(n(within(c).getByText('4,3 %').textContent)).toBe('4,3 %');
    expect(n(within(c).getByText('1,0 %').textContent)).toBe('1,0 %');
    expect(within(c).getByText('loyers ÷ coût total')).toBeInTheDocument();
    expect(within(c).getByText('charges et vacance déduites')).toBeInTheDocument();
    expect(within(c).getByText('après intérêts, assurance et impôt')).toBeInTheDocument();
    // Le net porte la couleur du feu « Rendement » (à surveiller).
    expect(within(c).getByText('4,3 %')).toHaveClass('text-surveiller-texte');
    const utilisateur = userEvent.setup();
    await utilisateur.click(
      within(c).getByRole('button', { name: 'Explication : Rendement brut' }),
    );
    expect(n(within(c).getByRole('tooltip').textContent)).toContain('11 760 € ÷ 172 987 € = 6,8 %');
  });
});
