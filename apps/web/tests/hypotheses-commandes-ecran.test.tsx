import { obtenirRegles, projetExemple, type ProjetEntree } from '@loupe/moteur';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import { apportPourPart, coutTotalDuProjet } from '@/annonces/apport';
import { ModeDocument } from '@/composants/document';
import { montrerChamp } from '@/coque/champ-cible';
import { ChampHypothese } from '@/ecrans/hypotheses/ChampHypothese';
import { descripteurParChemin, type Descripteur } from '@/hypotheses';
import { lireProjets } from '@/stockage/projets';
import { periodesConstruction } from '@/verifier/periodes';

const n = (s: string): string => s.replace(/\s/g, ' ');

/** Un champ d'hypothèse tenu dans un état local : `recus` garde chaque texte transmis. */
function banc(chemin: string, initial: string, projet?: ProjetEntree): { recus: string[] } {
  const recus: string[] = [];
  const d: Descripteur = descripteurParChemin(chemin);
  function Banc(): JSX.Element {
    const [texte, setTexte] = useState(initial);
    return (
      <ChampHypothese
        descripteur={d}
        texte={texte}
        badge={null}
        projet={projet}
        onChange={(t) => {
          recus.push(t);
          setTexte(t);
        }}
      />
    );
  }
  render(<Banc />);
  return { recus };
}

describe('ChampHypothese : les commandes du formulaire Vérifier', () => {
  it('montant : milliers espacés, chaîne brute transmise', async () => {
    const { recus } = banc('hypotheses.achat.prix', '');
    const saisie = screen.getByLabelText('Prix affiché');
    await userEvent.setup().type(saisie, '155000');
    expect(n((saisie as HTMLInputElement).value)).toBe('155 000');
    expect(recus.at(-1)).toBe('155000');
    expect(screen.getByText('€')).toBeInTheDocument();
  });

  it('compteur : − / + bornés, « RDC » à zéro, unité à côté', async () => {
    const u = userEvent.setup();
    const { recus } = banc('bien.etage', '1');
    await u.click(screen.getByRole('button', { name: 'Un de moins' }));
    expect(recus.at(-1)).toBe('0');
    expect(screen.getByText('RDC')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Un de moins' })).toBeDisabled();
    expect(screen.getByLabelText('Étage')).toHaveValue('0');
  });

  it('oui / non : un clic choisit, un second clic revient à inconnu', async () => {
    const u = userEvent.setup();
    const { recus } = banc('hypotheses.location.tourismeClasse', '');
    const groupe = screen.getByRole('radiogroup', { name: 'Meublé de tourisme classé' });
    await u.click(within(groupe).getByRole('radio', { name: 'Oui' }));
    expect(recus.at(-1)).toBe('oui');
    await u.click(within(groupe).getByRole('radio', { name: 'Oui' }));
    expect(recus.at(-1)).toBe('');
  });

  it('tuiles : libellés en majuscule, valeur de l’option transmise', async () => {
    const u = userEvent.setup();
    const { recus } = banc('bien.etat', 'bon_etat');
    const groupe = screen.getByRole('radiogroup', { name: 'État' });
    expect(within(groupe).getByRole('radio', { name: 'Bon état' })).toBeChecked();
    await u.click(within(groupe).getByRole('radio', { name: 'À rénover' }));
    expect(recus.at(-1)).toBe('a_renover');
  });

  it('échelle d’énergie : la lettre du DPE', async () => {
    const { recus } = banc('bien.dpe', 'D');
    await userEvent.setup().click(screen.getByRole('radio', { name: 'C' }));
    expect(recus.at(-1)).toBe('C');
  });

  it('année : période (année du milieu) ou année exacte', async () => {
    const u = userEvent.setup();
    const periodes = periodesConstruction(obtenirRegles('2026-09'));
    const { recus } = banc('bien.annee', '1962');
    // 1962 n'est pas une année représentative : la saisie exacte est ouverte.
    expect(screen.getByLabelText('Année exacte')).toHaveValue('1962');
    const premiere = periodes[0]!;
    await u.click(screen.getByRole('radio', { name: premiere.libelle }));
    expect(recus.at(-1)).toBe(String(premiere.representative));
    expect(screen.queryByLabelText('Année exacte')).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: "Je connais l'année" }));
    await u.type(screen.getByLabelText('Année exacte'), '1972');
    expect(recus.at(-1)).toBe('1972');
  });

  it('durée : tuiles 15 · 20 · 25 ans, « Autre » ouvre un compteur', async () => {
    const u = userEvent.setup();
    const { recus } = banc('hypotheses.pret.dureeAnnees', '25');
    await u.click(screen.getByRole('radio', { name: '20 ans' }));
    expect(recus.at(-1)).toBe('20');
    await u.click(screen.getByRole('radio', { name: 'Autre' }));
    await u.click(screen.getByRole('button', { name: 'Un an de plus' }));
    expect(recus.at(-1)).toBe('21');
  });

  it('apport : 20 % du coût total du projet, 0 %, montant tapé ; sans projet, un montant seul', async () => {
    const u = userEvent.setup();
    const { recus } = banc('hypotheses.pret.apport', '14337', projetExemple);
    const parts = screen.getByRole('radiogroup', { name: 'Part du coût total' });
    expect(within(parts).getByRole('radio', { name: 'Autre' })).toBeChecked();
    await u.click(within(parts).getByRole('radio', { name: '20 %' }));
    const cout = coutTotalDuProjet(projetExemple);
    expect(recus.at(-1)).toBe(String(apportPourPart(cout ?? 0, 0.2)));
    await u.click(within(parts).getByRole('radio', { name: '0 %' }));
    expect(recus.at(-1)).toBe('0');
  });

  it('apport sans projet : pas de parts, un montant', () => {
    banc('hypotheses.pret.apport', '14337');
    expect(screen.queryByRole('radiogroup', { name: 'Part du coût total' })).toBeNull();
    expect(n((screen.getByLabelText('Apport')).value)).toBe('14 337');
  });

  it('apport d’un projet invalide : les parts calculées sont indisponibles', () => {
    banc('hypotheses.pret.apport', '', {
      ...projetExemple,
      hypotheses: {
        ...projetExemple.hypotheses,
        pret: { ...projetExemple.hypotheses.pret, dureeAnnees: -1 },
      },
    });
    expect(screen.getByRole('radio', { name: '20 %' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: '0 %' })).toBeEnabled();
  });

  it('nuits louées : curseur avec le taux d’occupation, enregistré au relâchement', async () => {
    const u = userEvent.setup();
    const { recus } = banc('hypotheses.location.nuiteesParMois', '15');
    const curseur = screen.getByRole('slider', { name: 'Nuits louées par mois' });
    expect(n(curseur.getAttribute('aria-valuetext') ?? '')).toBe("15 nuits · 50 % d'occupation");
    curseur.focus();
    await u.keyboard('{ArrowRight}');
    expect(recus).toEqual(['16']);
  });

  it('nuits louées vides : le curseur dit « Je ne sais pas »', () => {
    banc('hypotheses.location.nuiteesParMois', '');
    expect(screen.getByRole('slider', { name: 'Nuits louées par mois' })).toHaveAttribute(
      'aria-valuetext',
      'Je ne sais pas',
    );
  });

  it('taux : saisie texte, le signe et la virgule passent tels quels', async () => {
    const { recus } = banc('hypotheses.revente.evolutionAnnuelle', '');
    await userEvent.setup().type(screen.getByLabelText('Évolution du prix'), '-1,5');
    expect(recus.at(-1)).toBe('-1,5');
  });

  it('en document : la valeur seule, aucune commande', () => {
    render(
      <ModeDocument>
        <ChampHypothese
          descripteur={descripteurParChemin('hypotheses.achat.prix')}
          texte="155000"
          badge={{ ton: 'neutre', libelle: 'annonce' }}
          onChange={() => undefined}
        />
      </ModeDocument>,
    );
    expect(n(screen.getByText(/155/).textContent)).toBe('155 000 €');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('annonce')).toBeInTheDocument();
  });
});

describe('ancres de la fiche 17 : le focus vise la commande', () => {
  it('la tuile cochée d’un choix, la saisie d’un compteur (pas son bouton −)', () => {
    banc('bien.dpe', 'D');
    banc('bien.pieces', '3');
    banc('bien.ascenseur', '');
    expect(montrerChamp(document, 'bien.dpe')).toBe(true);
    expect(screen.getByRole('radio', { name: 'D' })).toHaveFocus();
    montrerChamp(document, 'bien.pieces');
    expect(screen.getByLabelText('Pièces')).toHaveFocus();
    // Aucun choix : la première tuile.
    montrerChamp(document, 'bien.ascenseur');
    expect(screen.getByRole('radio', { name: 'Oui' })).toHaveFocus();
  });
});

describe('onglet Hypothèses', () => {
  it('le DPE et les pièces se changent d’un clic et sont enregistrés', async () => {
    const u = userEvent.setup();
    render(<AppEnMemoire chemin="/projets" />);
    await screen.findByRole('heading', { name: 'Mes projets' });
    const id = lireProjets(window.localStorage)[0]?.id ?? '';
    render(<AppEnMemoire chemin={`/projets/${id}/hypotheses`} />);
    await screen.findByRole('heading', { name: 'Vos hypothèses' });

    await u.click(
      within(screen.getByRole('radiogroup', { name: 'DPE' })).getByRole('radio', { name: 'C' }),
    );
    const champPieces = document.querySelector('[data-champ="bien.pieces"]')!;
    await u.click(within(champPieces).getByRole('button', { name: 'Un de plus' }));

    const bien = lireProjets(window.localStorage)[0]?.projet.bien;
    expect(bien?.dpe).toBe('C');
    expect(bien?.pieces).toBe(4);
  });
});
