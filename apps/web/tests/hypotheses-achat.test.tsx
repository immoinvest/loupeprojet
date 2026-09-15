import { calculerProjet, projetExemple } from '@loupe/moteur';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { pourcentPourViser } from '@/analyses';
import { AppEnMemoire } from '@/App';
import { Curseur } from '@/composants/Curseur';
import { ModeDocument } from '@/composants/document';
import { creerProjet, ecrireProjets, lireProjets, type ProjetEnregistre } from '@/stockage/projets';

const n = (s: string | null | undefined): string => (s ?? '').replace(/\s/g, ' ');

const projetEnregistre = (): ProjetEnregistre['projet'] =>
  lireProjets(window.localStorage)[0]!.projet;

async function ouvrirHypotheses(): Promise<void> {
  render(<AppEnMemoire chemin="/projets" />);
  await screen.findByRole('heading', { name: 'Mes projets' });
  const id = lireProjets(window.localStorage)[0]?.id ?? '';
  render(<AppEnMemoire chemin={`/projets/${id}/hypotheses`} />);
  await screen.findByRole('heading', { name: 'Vos hypothèses' });
}

const slider = (): HTMLElement => screen.getByRole('slider', { name: 'Négociation' });
const champNegociation = (): HTMLElement => screen.getByRole('textbox', { name: /^Négociation/ });

describe('carte « L’achat » : négociation', () => {
  it('le curseur et le champ règlent la même négociation ; le prix retenu suit', async () => {
    await ouvrirHypotheses();
    expect(slider()).toHaveValue('0');
    expect(slider()).toHaveAttribute('aria-valuetext', '0 %');
    expect(slider()).toHaveAttribute('min', '0');
    expect(slider()).toHaveAttribute('max', '15');
    expect(slider()).toHaveAttribute('step', '0.5');
    expect(n(screen.getByText(/^Prix retenu/).textContent)).toBe('Prix retenu 155 000 €');

    fireEvent.change(slider(), { target: { value: '5' } });
    expect(projetEnregistre().hypotheses.achat.negociationTaux).toBe(0.05);
    expect(projetEnregistre().provenance['achat.negociationTaux']).toBe('utilisateur');
    expect(n(screen.getByText(/^Prix retenu/).textContent)).toBe(
      'Prix retenu 147 250 € · −7 750 € (−5 %)',
    );
    expect(champNegociation()).toHaveValue('5');
    expect(slider()).toHaveAttribute('aria-valuetext', '−5 %');
    // La synthèse est recalculée : moins cher, meilleur cash-flow qu'à −210 €/mois.
    const synthese = screen.getAllByText('Cash-flow', { exact: true }).at(-1)?.parentElement;
    expect(n(synthese?.textContent)).not.toContain('−210 €/mois');

    const utilisateur = userEvent.setup();
    await utilisateur.clear(champNegociation());
    await utilisateur.type(champNegociation(), '20');
    expect(projetEnregistre().hypotheses.achat.negociationTaux).toBe(0.2);
    // Au-delà du curseur : il se place en butée, la valeur reste dans le champ.
    expect(slider()).toHaveValue('15');
    expect(champNegociation()).toHaveValue('20');

    // 40 % dépasse la borne du schéma : refusé, la dernière valeur valide (4 %) reste en vigueur.
    await utilisateur.clear(champNegociation());
    await utilisateur.type(champNegociation(), '40');
    expect(projetEnregistre().hypotheses.achat.negociationTaux).toBe(0.04);
    expect(champNegociation().closest('div')?.textContent).toMatch(/0\.3/);
  });

  it('« Viser le prix estimé » n’apparaît que si l’estimation est sous le prix affiché', async () => {
    await ouvrirHypotheses();
    // L'exemple est estimé 206 733 €, au-dessus des 155 000 € affichés : rien à négocier d'après le marché.
    expect(screen.queryByRole('button', { name: 'Viser le prix estimé' })).toBeNull();
    expect(screen.getByText(/déjà sous le prix estimé/)).toBeInTheDocument();

    // Un marché à 2 000 €/m² : le bien vaut moins que son prix affiché. Le repère DVF ne se saisit
    // plus dans Hypothèses (il vient de l'onglet Estimation) : on l'écrit dans le projet enregistré.
    cleanup();
    const marche = projetExemple.marche ?? { risques: [] };
    ecrireProjets(window.localStorage, [
      creerProjet({
        source: {
          ...projetExemple,
          marche: { ...marche, dvf: { ...marche.dvf!, medianM2: 2_000 } },
        },
        genererId: () => 'marche-bas',
      }),
    ]);
    render(<AppEnMemoire chemin="/projets/marche-bas/hypotheses" />);
    await screen.findAllByRole('heading', { name: 'Vos hypothèses' });
    const utilisateur = userEvent.setup();
    expect(screen.queryByText(/déjà sous le prix estimé/)).toBeNull();
    expect(screen.getByText(/^Prix estimé /)).toBeInTheDocument();
    await utilisateur.click(screen.getByRole('button', { name: 'Viser le prix estimé' }));

    const projet = projetEnregistre();
    const centre = calculerProjet(projet).estimation?.centre ?? 0;
    const attendu = pourcentPourViser(projet.hypotheses.achat, centre) ?? 0;
    expect(centre).toBeLessThan(155_000);
    expect(attendu).toBeGreaterThan(0);
    expect(projet.hypotheses.achat.negociationTaux).toBeCloseTo(attendu / 100, 10);
  });

  it('sans ventes réelles, ni bouton ni phrase', async () => {
    ecrireProjets(window.localStorage, [
      creerProjet({
        source: { ...projetExemple, marche: {} },
        genererId: () => 'sans-marche',
      }),
    ]);
    render(<AppEnMemoire chemin="/projets/sans-marche/hypotheses" />);
    await screen.findByRole('heading', { name: 'Vos hypothèses' });
    expect(screen.queryByRole('button', { name: 'Viser le prix estimé' })).toBeNull();
    expect(screen.queryByText(/déjà sous le prix estimé/)).toBeNull();
    expect(screen.queryByText(/^Prix estimé /)).toBeNull();
  });
});

describe('carte « L’achat » : travaux repliés', () => {
  it('avec des travaux, le dépliant est ouvert ; la rénovation énergétique n’apparaît qu’en nu', async () => {
    await ouvrirHypotheses();
    // L'exemple a 6 000 € de travaux et 5 000 € de mobilier.
    const depliant = screen.getByRole('button', { name: /^Travaux 6/ });
    expect(n(depliant.textContent)).toBe('Travaux 6 000 € · mobilier 5 000 €');
    expect(depliant).toHaveAttribute('aria-expanded', 'true');
    const valeur = (nom: RegExp): string =>
      (screen.getByRole('textbox', { name: nom })).value.replace(/\s/g, ' ');
    expect(valeur(/^Travaux/)).toBe('6 000');
    expect(valeur(/^Mobilier/)).toBe('5 000');
    // Meublé : la case de rénovation énergétique ne joue pas.
    expect(screen.queryByRole('radiogroup', { name: /classes E, F ou G/ })).toBeNull();

    const utilisateur = userEvent.setup();
    await utilisateur.click(screen.getByRole('radio', { name: 'Nue' }));
    const renovation = screen.getByRole('radiogroup', { name: /classes E, F ou G/ });
    expect(screen.getByText(/porté de 10 700 € à 21 400 €/)).toBeInTheDocument();
    await utilisateur.click(within(renovation).getByRole('radio', { name: 'Oui' }));
    expect(projetEnregistre().hypotheses.achat.travauxRenovationEnergetique).toBe(true);

    // Sans travaux, la case disparaît et le dépliant se résume à « + Ajouter des travaux ».
    await utilisateur.clear(screen.getByRole('textbox', { name: /^Travaux/ }));
    expect(projetEnregistre().hypotheses.achat.travaux).toBe(0);
    expect(screen.queryByRole('radiogroup', { name: /classes E, F ou G/ })).toBeNull();
    const ferme = screen.getByRole('button', { name: /^\+ Ajouter des travaux/ });
    expect(n(ferme.textContent)).toBe('+ Ajouter des travaux · mobilier 5 000 €');
    await utilisateur.click(ferme);
    expect(ferme).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('textbox', { name: /^Travaux/ })).toBeNull();
  });

  it('sans travaux, le dépliant est fermé et s’ouvre d’un clic', async () => {
    ecrireProjets(window.localStorage, [
      creerProjet({
        source: {
          ...projetExemple,
          hypotheses: {
            ...projetExemple.hypotheses,
            achat: { ...projetExemple.hypotheses.achat, travaux: 0, mobilier: 0 },
          },
        },
        genererId: () => 'sans-travaux',
      }),
    ]);
    render(<AppEnMemoire chemin="/projets/sans-travaux/hypotheses" />);
    await screen.findByRole('heading', { name: 'Vos hypothèses' });
    const bouton = screen.getByRole('button', { name: '+ Ajouter des travaux' });
    expect(bouton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('textbox', { name: /^Travaux/ })).toBeNull();
    await userEvent.setup().click(bouton);
    expect(screen.getByRole('textbox', { name: /^Travaux/ })).toHaveValue('0');
    expect(screen.getByRole('textbox', { name: /^Mobilier/ })).toHaveValue('0');
  });
});

describe('Curseur', () => {
  it('en mode document, écrit la valeur sans rien de réglable', () => {
    render(
      <ModeDocument>
        <Curseur
          libelle="Négociation"
          valeur={5}
          min={0}
          max={15}
          pas={0.5}
          formater={(v) => `−${String(v)} %`}
          onChangement={() => undefined}
        />
      </ModeDocument>,
    );
    expect(screen.queryByRole('slider')).toBeNull();
    expect(n(screen.getByText(/Négociation/).textContent)).toBe('Négociation −5 %');
  });
});
