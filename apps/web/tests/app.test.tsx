import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import { CLE_STOCKAGE, lireProjets } from '@/stockage/projets';

import { saisirApport, saisirCommune } from './aides-verifier';

const n = (s: string | null): string => (s ?? '').replace(/\s/g, ' ');

async function ouvrirExemple(): Promise<string> {
  render(<AppEnMemoire chemin="/projets" />);
  await screen.findByRole('heading', { name: 'Mes projets' });
  const id = lireProjets(window.localStorage)[0]?.id ?? '';
  render(<AppEnMemoire chemin={`/projets/${id}`} />);
  await screen.findByRole('heading', { name: /Le prix est bon/ });
  return id;
}

describe('Mes projets', () => {
  it('amorce le stockage avec le projet d’exemple ; la racine est l’accueil', async () => {
    render(<AppEnMemoire chemin="/" />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bienvenue sur Deklic' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('T3 · 65 m² · Marseille 5e').length).toBeGreaterThan(0);
    expect(lireProjets(window.localStorage)).toHaveLength(1);
    expect(window.localStorage.getItem(CLE_STOCKAGE)).not.toBeNull();
  });

  it('affiche les métriques du moteur et le statut', async () => {
    render(<AppEnMemoire chemin="/projets" />);
    await screen.findByRole('heading', { name: 'Mes projets' });
    expect(n(screen.getByText(/−210 €\/mois/).textContent)).toBe('−210 €/mois');
    expect(n(screen.getByText(/−25 %/).textContent)).toBe('−25 %');
    expect(screen.getByText('Visite prévue')).toBeInTheDocument();
  });

  it('crée un projet, le filtre et le supprime', { timeout: 30_000 }, async () => {
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin="/projets" />);
    await screen.findByRole('heading', { name: 'Mes projets' });

    // Deux boutons « Nouveau projet » : barre latérale et en-tête de page. On prend celui de la page.
    await utilisateur.click(screen.getAllByRole('button', { name: 'Nouveau projet' }).at(-1)!);
    expect(await screen.findByRole('heading', { name: /Colle le lien/ })).toBeInTheDocument();

    await utilisateur.click(screen.getByRole('button', { name: /je saisis à la main/ }));
    await utilisateur.type(screen.getByLabelText(/Prix affiché/), '120000');
    await utilisateur.type(screen.getByLabelText(/Surface/), '40');
    await saisirCommune(utilisateur, '69003 Lyon');
    await utilisateur.type(screen.getByLabelText(/Loyer visé/), '700');
    await saisirApport(utilisateur, '10000');
    await utilisateur.click(screen.getByRole('button', { name: /Créer le projet/ }));
    expect(
      await screen.findByRole(
        'heading',
        { name: /Prix sans repère de marché/ },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument();
    expect(lireProjets(window.localStorage)).toHaveLength(2);
    expect(lireProjets(window.localStorage)[0]?.nom).toBe('40 m² · Lyon');

    await utilisateur.click(screen.getByRole('link', { name: 'Mes projets' }));
    await screen.findByRole('heading', { name: 'Mes projets' });
    // Le compteur apparaît dans l'en-tête de page et dans le profil de la barre latérale.
    expect(screen.getAllByText(/2 projets/).length).toBeGreaterThanOrEqual(1);

    await utilisateur.click(screen.getByRole('button', { name: 'Écartés' }));
    expect(screen.getByText('Aucun projet dans cette liste.')).toBeInTheDocument();
    await utilisateur.click(screen.getByRole('button', { name: 'Tous' }));

    await utilisateur.click(screen.getByRole('button', { name: /Supprimer 40 m² · Lyon/ }));
    expect(lireProjets(window.localStorage)).toHaveLength(1);
  });
});

describe('Rapport', () => {
  it('affiche le verdict, les cinq feux et les cartes avec les chiffres du moteur', async () => {
    await ouvrirExemple();

    expect(
      screen.getByRole('heading', { name: 'Le prix est bon. Le loyer ne couvre pas tout.' }),
    ).toBeInTheDocument();
    const feux = screen.getAllByLabelText('Cinq feux').at(-1);
    expect(feux).toBeDefined();
    expect(within(feux!).getAllByText(/Prix|Rendement|Cash-flow|Crédit|Risques/)).toHaveLength(5);

    expect(screen.getByRole('heading', { name: "Est-ce que c'est cher ?" })).toBeInTheDocument();
    // « Non. » deux fois : ce n'est pas cher, et ça ne s'autofinance pas (−210 €/mois).
    expect(screen.getAllByText('Non.')).toHaveLength(2);
    // Le loyer d'équilibre : dans son repère, et dans le texte de sa bulle (fermée).
    expect(n(screen.getByText('1 203 €', { selector: 'span' }).textContent)).toBe('1 203 €');
    expect(screen.getByText('Levier 1 · Négocier')).toBeInTheDocument();
    expect(n(screen.getByText(/119 663 €/).textContent)).toContain('119 663 €');
    // Le régime retenu mène à son champ (lien d'hypothèse) : carte de l'impôt et cascade.
    expect(
      screen.getAllByRole('link', { name: 'Meublé au réel — modifier Régime retenu' }).length,
    ).toBeGreaterThan(0);
    // Le cash net de revente : en gros chiffre, et dans le texte de sa bulle (fermée). 58 217 € avant
    // impôt, moins 418 € sur les amortissements réintégrés (fiscalité, ordre d'imputation LMNP).
    // Puis 723 € avec le prix de l'acte dans la plus-value (BOI-RFPI-PVI-20-10-20-20 § 40 et 70).
    expect(n(screen.getByText('57 493 €').textContent)).toContain('57 493 €');
  });

  it('les pages non livrées affichent un état « bientôt », un id inconnu une page introuvable', async () => {
    await ouvrirExemple();
    const utilisateur = userEvent.setup();
    // Deux barres latérales sont montées (liste puis projet) : on prend le lien de la dernière.
    await utilisateur.click(screen.getAllByRole('link', { name: 'Accueil' }).at(-1)!);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bienvenue sur Deklic' }),
    ).toBeInTheDocument();

    render(<AppEnMemoire chemin="/projets/inconnu" />);
    expect(await screen.findByRole('heading', { name: 'Projet introuvable' })).toBeInTheDocument();
  });

  it(
    'modifie une hypothèse : recalcul, enregistrement, provenance, erreurs',
    { timeout: 30_000 },
    async () => {
      await ouvrirExemple();
      const utilisateur = userEvent.setup();
      await utilisateur.click(screen.getByRole('link', { name: 'Hypothèses' }));
      await screen.findByRole('heading', { name: 'Vos hypothèses' });

      const loyer = screen.getByLabelText(/Loyer visé, hors charges/);
      expect(loyer).toHaveValue('980');
      await utilisateur.clear(loyer);
      await utilisateur.type(loyer, '1300');
      expect(lireProjets(window.localStorage)[0]?.projet.hypotheses.location).toMatchObject({
        loyerHc: 1300,
      });
      expect(lireProjets(window.localStorage)[0]?.projet.provenance['location.loyerHc']).toBe(
        'utilisateur',
      );
      expect(screen.getByText(/\+\d+ €\/mois/)).toBeInTheDocument();

      const prix = screen.getByLabelText(/Prix affiché/);
      await utilisateur.clear(prix);
      expect(screen.getByText('Cette valeur est nécessaire au calcul.')).toBeInTheDocument();
      expect(lireProjets(window.localStorage)[0]?.projet.hypotheses.achat.prix).toBe(155_000);
      await utilisateur.type(prix, '150000');
      expect(screen.queryByText('Cette valeur est nécessaire au calcul.')).not.toBeInTheDocument();
      expect(lireProjets(window.localStorage)[0]?.projet.hypotheses.achat.prix).toBe(150_000);

      // Le prêt n'est plus dans Hypothèses : il se règle dans Financement.
      expect(screen.queryByLabelText(/Différé total/)).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Le marché' })).not.toBeInTheDocument();

      await utilisateur.click(screen.getByRole('radio', { name: 'Courte durée' }));
      expect(
        screen.getByRole('heading', { name: 'La location — Courte durée' }),
      ).toBeInTheDocument();
      // 1 300 € / 30 nuits × 2 = 86,7 → 87 € ; 15 nuits par mois par défaut (règles 2026-09).
      expect(screen.getByLabelText(/Prix de la nuitée/)).toHaveValue('87');
      expect(screen.getByLabelText(/Nuits louées par mois/)).toHaveValue('15');
      expect(screen.queryByLabelText(/Loyer visé/)).not.toBeInTheDocument();
    },
  );

  it('change le statut depuis l’en-tête', async () => {
    await ouvrirExemple();
    const utilisateur = userEvent.setup();
    await utilisateur.click(screen.getByLabelText('Statut du projet'));
    await utilisateur.click(screen.getByRole('option', { name: 'Offre faite' }));
    expect(lireProjets(window.localStorage)[0]?.statut).toBe('offre');
    expect(screen.getByLabelText('Statut du projet')).toHaveTextContent('Offre faite');
  });
});
