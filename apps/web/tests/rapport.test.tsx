import { projetExemple } from '@loupe/moteur';
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
    expect(icones.map((b) => b.textContent)).toEqual([
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

describe('Rapport : disposition serrée', () => {
  it('à côté du prix, les rendements puis « Avant de faire une offre » dans une même colonne', async () => {
    await ouvrirRapport();
    const prix = carte("Est-ce que c'est cher ?");
    const rendements = carte('Combien ça rapporte ?');
    const vigilance = carte('Avant de faire une offre');
    const colonne = rendements.parentElement!;
    expect(vigilance.parentElement).toBe(colonne);
    expect([...colonne.children]).toEqual([rendements, vigilance]);
    expect(colonne).toHaveClass('flex', 'flex-col');
    // La colonne est la voisine du prix dans la rangée à deux cartes.
    expect(prix.parentElement).toBe(colonne.parentElement);
    expect([...prix.parentElement!.children]).toEqual([prix, colonne]);
    // La dernière carte s'étire jusqu'au bas du prix ; son lien descend en bas.
    expect(vigilance).toHaveClass('flex-1');
    expect(
      within(vigilance)
        .getByRole('link', { name: /visite/i })
        .closest('p'),
    ).toHaveClass('mt-auto');

    const titres = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titres).toEqual([
      "Est-ce que ça s'autofinance ?",
      "Est-ce que c'est cher ?",
      'Combien ça rapporte ?',
      'Avant de faire une offre',
      "Combien d'impôts ?",
      "Qu'est-ce qu'il vous restera ?",
    ]);
  });
});

describe('Rapport : prix, impôts et revente', () => {
  it('chaque carte mène à son onglet par un lien distinct de l’icône', async () => {
    await ouvrirRapport();
    expect(screen.getByRole('link', { name: "Voir l'estimation" })).toHaveAttribute(
      'href',
      '/projets/exemple/adresse',
    );
    expect(screen.getByRole('link', { name: 'Voir la fiscalité' })).toHaveAttribute(
      'href',
      '/projets/exemple/fiscalite',
    );
    expect(screen.getByRole('link', { name: 'Voir la revente' })).toHaveAttribute(
      'href',
      '/projets/exemple/revente',
    );
    // Prix jugé bon : la carte ne s'allonge plus d'une phrase sur la visite (la question reste dans Visite).
    expect(within(carte("Est-ce que c'est cher ?")).getByText('Non.')).toBeInTheDocument();
    expect(screen.queryByText(/Un prix aussi bas/)).not.toBeInTheDocument();
    // Les faux liens d'avant ont disparu.
    expect(screen.queryByText('Pourquoi ?')).not.toBeInTheDocument();
    expect(screen.queryByText('Comparer les 4 régimes')).not.toBeInTheDocument();
    expect(screen.queryByText('Détail')).not.toBeInTheDocument();

    const utilisateur = userEvent.setup();
    await utilisateur.click(screen.getByRole('link', { name: 'Voir la fiscalité' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /Combien d'impôts, selon le régime/ }),
    ).toBeInTheDocument();
  });

  it('les icônes des trois cartes ouvrent des bulles chiffrées', async () => {
    await ouvrirRapport();
    const utilisateur = userEvent.setup();
    const prix = carte("Est-ce que c'est cher ?");
    await utilisateur.click(
      within(prix).getByRole('button', { name: "Explication : Est-ce que c'est cher ?" }),
    );
    expect(n(within(prix).getByRole('tooltip').textContent)).toContain(
      '2 385 €/m² contre un prix estimé de 3 181 €/m²',
    );

    const impots = carte("Combien d'impôts ?");
    await utilisateur.click(
      within(impots).getByRole('button', { name: "Explication : Combien d'impôts ?" }),
    );
    expect(n(within(impots).getByRole('tooltip').textContent)).toContain(
      'le meublé au réel ne coûte aucun impôt',
    );
    // Une seule bulle ouverte à la fois.
    expect(within(prix).queryByRole('tooltip')).not.toBeInTheDocument();

    const revente = carte("Qu'est-ce qu'il vous restera ?");
    await utilisateur.click(
      within(revente).getByRole('button', { name: "Explication : Qu'est-ce qu'il vous restera ?" }),
    );
    expect(n(within(revente).getByRole('tooltip').textContent)).toContain('59 864 € net vendeur');
  });

  it('les impôts : la location du régime retenu, puis les régimes comparés sur l’impôt total', async () => {
    await ouvrirRapport();
    const impots = carte("Combien d'impôts ?");
    // Le montant et son complément sont deux éléments séparés par une marge : pas d'espace entre eux.
    expect(n(impots.textContent)).toMatch(/0 € ?sur 10 ans de location/);
    // Meublé au réel : rien pendant la location, 723 € à la revente (amortissements réintégrés).
    expect(n(impots.textContent)).toContain('Impôt total, revente comprise : 723 €');
    const autres = within(impots).getByRole('list', { name: 'Impôt total des autres régimes' });
    expect(
      within(autres)
        .getAllByRole('listitem')
        .map((li) => n(li.textContent)),
    ).toEqual(['Nu au réel 4 426 €', 'Meublé micro-BIC 26 928 €', 'Nu micro-foncier 31 757 €']);
  });

  it('en micro-BIC, le meublé au réel se compare avec son impôt à la revente', async () => {
    const p = creerProjet({
      nom: 'Micro-BIC',
      genererId: () => 'micro',
      source: {
        ...projetExemple,
        hypotheses: {
          ...projetExemple.hypotheses,
          fiscalite: { ...projetExemple.hypotheses.fiscalite, regime: 'micro_bic' },
        },
      },
    });
    ecrireProjets(window.localStorage, [p]);
    render(<AppEnMemoire chemin="/projets/micro" />);
    await screen.findByRole('heading', { level: 1, name: /Le prix est bon/ });
    const impots = carte("Combien d'impôts ?");
    expect(n(impots.textContent)).toMatch(/26 928 € ?sur 10 ans de location/);
    expect(n(impots.textContent)).toContain('Impôt total, revente comprise : 26 928 €');
    const autres = within(impots).getByRole('list', { name: 'Impôt total des autres régimes' });
    // Trié sur l'impôt total : 723 € (et non 0 €) pour le meublé au réel, toujours le moins cher.
    expect(
      within(autres)
        .getAllByRole('listitem')
        .map((li) => n(li.textContent)),
    ).toEqual(['Meublé au réel 723 €', 'Nu au réel 4 426 €', 'Nu micro-foncier 31 757 €']);
  });

  it('la revente affiche le multiple sur apport avec sa bulle', async () => {
    await ouvrirRapport();
    const revente = carte("Qu'est-ce qu'il vous restera ?");
    expect(within(revente).getByText('Multiple sur apport')).toBeInTheDocument();
    expect(n(within(revente).getByText('× 0,8').textContent)).toBe('× 0,8');
    const utilisateur = userEvent.setup();
    await utilisateur.click(
      within(revente).getByRole('button', { name: 'Explication : Multiple sur apport' }),
    );
    expect(n(within(revente).getByRole('tooltip').textContent)).toContain(
      '15 294 € ÷ 19 337 € = × 0,8',
    );
  });

  it('dans le document imprimé : les explications sous les titres, ni icônes ni liens', async () => {
    await ouvrirRapport('/imprimer');
    await screen.findByText(/dossier d'analyse locative/);
    expect(screen.queryByRole('button', { name: /^Explication : / })).not.toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Voir / })).not.toBeInTheDocument();
    for (const extrait of [
      /ventes signées chez le notaire/,
      /paie d'abord le crédit et l'assurance/,
      /représente 84 % du loyer/,
      /Ce que vous sortez de votre poche/,
      /Point mort : le loyer hors charges/,
      /11 760 €/,
      /C'est lui que juge le feu/,
      /une fois la banque et le fisc servis/,
      /Le moins cher des trois autres régimes/,
      /net vendeur\./,
      /Gain total ÷ mise de départ/,
    ]) {
      expect(screen.getAllByText(extrait).length).toBeGreaterThan(0);
    }
  });
});
