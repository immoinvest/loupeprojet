import { obtenirRegles } from '@loupe/moteur';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import {
  CLE_SIMULATEUR,
  appliquerTexte,
  ecrireSimulation,
  fragmentSimulation,
  lireSimulation,
  saisieDefaut,
  versSimulation,
} from '@/simulateur';

// Aucun Blob réel : jsdom n'a pas d'URL.createObjectURL. Le téléchargement est doublé.
vi.mock('@/ecrans/simulateur/telecharger', () => ({ telechargerTexte: vi.fn() }));
import { telechargerTexte } from '@/ecrans/simulateur/telecharger';

const regles = obtenirRegles('2026-09');
const n = (s: string | null): string => (s ?? '').replace(/\s/g, ' ');

/**
 * La carte (section) dont le titre de niveau 2 est `titre`. Le formulaire d'une offre et ses
 * résultats portent le même titre : `rang` 0 est le formulaire, 1 la carte de résultats.
 */
function carte(titre: string, rang = 0): HTMLElement {
  const h2 = screen.getAllByRole('heading', { level: 2, name: titre })[rang];
  const section = h2?.closest('section') ?? null;
  if (section === null) throw new Error(`carte « ${titre} » introuvable`);
  return section;
}

async function ouvrir(chemin = '/simulateur-pret'): Promise<ReturnType<typeof userEvent.setup>> {
  const utilisateur = userEvent.setup();
  render(<AppEnMemoire chemin={chemin} />);
  await screen.findByRole('heading', { level: 1, name: 'Comparer deux offres de prêt' });
  return utilisateur;
}

/** Une simulation valide avec deux offres nommées, prête à mettre en mémoire ou dans un lien. */
function simulationLclCic(): NonNullable<ReturnType<typeof versSimulation>['simulation']> {
  let s = saisieDefaut(regles);
  s = appliquerTexte(s, regles, 'a', 'nom', 'LCL');
  s = appliquerTexte(s, regles, 'a', 'tauxNominal', '3,3');
  s = appliquerTexte(s, regles, 'a', 'dureeAnnees', '25');
  s = appliquerTexte(s, regles, 'b', 'nom', 'CIC');
  s = appliquerTexte(s, regles, 'b', 'tauxNominal', '1,7');
  const simulation = versSimulation(s).simulation;
  if (simulation === null) throw new Error('simulation attendue');
  return simulation;
}

describe('Simulateur de prêt — page', () => {
  it('ouvre avec les défauts : trois cartes, résultats déjà calculés, offres identiques', async () => {
    await ouvrir();
    expect(carte('Le projet financé')).toBeInTheDocument();
    const a = carte('Offre A');
    const b = carte('Offre B');
    expect(within(a).getByLabelText(/Taux nominal/)).toHaveValue('3.27');
    expect(within(a).getByText('taux du mois')).toBeInTheDocument();
    expect(within(b).getByLabelText(/Durée/)).toHaveValue('20');
    expect(screen.getByLabelText(/Prix affiché/)).toHaveValue('150000');
    expect(within(carte('Le projet financé')).getByText('estimé')).toBeInTheDocument();
    expect(screen.getByText('Les deux offres sont identiques.')).toBeInTheDocument();
    // Deux cartes de résultats : le montant emprunté y figure deux fois.
    expect(screen.getAllByText('Montant emprunté').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('group', { name: 'Offre affichée' })).toBeInTheDocument();
    // Rien n'est enregistré avant une première modification.
    expect(window.localStorage.getItem(CLE_SIMULATEUR)).toBeNull();
  });

  it('recalcule à chaque frappe, compare, enregistre et met le lien dans l’adresse', async () => {
    const utilisateur = await ouvrir();
    const a = carte('Offre A');
    await utilisateur.clear(within(a).getByLabelText(/Taux nominal/));
    await utilisateur.type(within(a).getByLabelText(/Taux nominal/), '3,3');
    await utilisateur.clear(within(a).getByLabelText(/Durée/));
    await utilisateur.type(within(a).getByLabelText(/Durée/), '25');
    // Banque, apport et désormais le taux nominal sont « à toi ».
    expect(within(a).getAllByText('à toi')).toHaveLength(3);

    const comparaison = carte('Laquelle coûte le moins ?');
    expect(within(comparaison).getAllByText('meilleure').length).toBeGreaterThan(0);
    expect(
      within(comparaison).getByText(
        /Offre A a la mensualité la plus basse .* Offre B le coût total le plus bas/,
      ),
    ).toBeInTheDocument();
    expect(within(comparaison).getByText(/comparez le coût total/)).toBeInTheDocument();
    expect(within(comparaison).getByRole('row', { name: /^Durée/ })).toHaveTextContent('25 ans');

    await waitFor(() => {
      expect(lireSimulation(window.localStorage)?.offres[0]?.dureeAnnees).toBe(25);
    });
    expect(window.location.hash).toMatch(/^#s=/);
  });

  it('montre l’erreur d’un champ, garde l’autre offre calculée et masque la comparaison', async () => {
    const utilisateur = await ouvrir();
    const a = carte('Offre A');
    await utilisateur.type(within(a).getByLabelText(/Taux nominal/), 'x');
    expect(within(a).getByText('Pourcentage attendu, par exemple 3,35.')).toBeInTheDocument();
    expect(screen.getByText('Corrigez les champs en rouge.')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Laquelle coûte le moins ?' }),
    ).not.toBeInTheDocument();
    // L'offre B reste calculée : un seul onglet de tableau, sans groupe de choix.
    expect(screen.queryByRole('group', { name: 'Offre affichée' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: /Tableau d'amortissement, Offre B/ }),
    ).toBeInTheDocument();

    // Le taux redevient lisible : c'est alors le schéma qui contrôle le différé.
    await utilisateur.clear(within(a).getByLabelText(/Taux nominal/));
    await utilisateur.type(within(a).getByLabelText(/Taux nominal/), '3');
    await utilisateur.clear(within(a).getByLabelText(/Différé total/));
    await utilisateur.type(within(a).getByLabelText(/Différé total/), '300');
    expect(within(a).getByText('Le différé doit être plus court que le prêt')).toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: /Tableau d'amortissement, Offre B/ }),
    ).toBeInTheDocument();
  });

  it('frais de notaire : estimés puis « à toi », ré-estimés sur demande, taux du département', async () => {
    const utilisateur = await ouvrir();
    const projet = carte('Le projet financé');
    const frais = within(projet).getByLabelText(/Frais de notaire/);
    const estimes = frais.getAttribute('value') ?? '';
    await utilisateur.clear(screen.getByLabelText(/Prix affiché/));
    await utilisateur.type(screen.getByLabelText(/Prix affiché/), '200000');
    const suivis = frais.getAttribute('value') ?? '';
    expect(Number(suivis)).toBeGreaterThan(Number(estimes));

    // « Vos revenus nets » est toujours « à toi » ; les frais modifiés le deviennent aussi.
    expect(within(projet).getAllByText('à toi')).toHaveLength(1);
    await utilisateur.clear(frais);
    await utilisateur.type(frais, '9000');
    expect(within(projet).getAllByText('à toi')).toHaveLength(2);
    expect(within(projet).queryByText('estimé')).not.toBeInTheDocument();
    await utilisateur.type(screen.getByLabelText(/Prix affiché/), '0');
    expect(frais).toHaveValue('9000');
    await utilisateur.click(within(projet).getByRole('button', { name: 'Ré-estimer' }));
    expect(Number(frais.getAttribute('value'))).toBeGreaterThan(Number(suivis));
    expect(within(projet).getByText('estimé')).toBeInTheDocument();
    expect(within(projet).queryByRole('button', { name: 'Ré-estimer' })).not.toBeInTheDocument();

    const avantDepartement = frais.getAttribute('value') ?? '';
    await utilisateur.type(within(projet).getByLabelText(/Département/), '36');
    expect(Number(frais.getAttribute('value'))).toBeLessThan(Number(avantDepartement));
  });

  it('rien à emprunter quand l’apport couvre tout ; usure et endettement signalés', async () => {
    const utilisateur = await ouvrir();
    const a = carte('Offre A');
    await utilisateur.type(within(a).getByLabelText(/^Apport/), '400000');
    const resultats = screen.getAllByText("Rien à emprunter : l'apport couvre tout.");
    expect(resultats).toHaveLength(1);
    expect(screen.getByText('Pas de tableau : rien à emprunter.')).toBeInTheDocument();

    await utilisateur.clear(within(a).getByLabelText(/^Apport/));
    await utilisateur.clear(within(a).getByLabelText(/Taux nominal/));
    await utilisateur.type(within(a).getByLabelText(/Taux nominal/), '6');
    expect(screen.getByText(/au-dessus du taux d'usure \(5,29 %/)).toBeInTheDocument();

    await utilisateur.type(screen.getByLabelText(/Vos revenus nets/), '2000');
    expect(screen.getAllByText("Taux d'endettement (mensualité ÷ revenus)").length).toBe(2);
    expect(screen.getAllByText(/au-delà de 35 % : surveiller/)).toHaveLength(2);
  });

  it('retire l’offre B puis la remet, copiée sur A', async () => {
    const utilisateur = await ouvrir();
    await utilisateur.type(within(carte('Offre A')).getByLabelText(/Banque/), 'LCL');
    await utilisateur.click(screen.getByRole('button', { name: "Retirer l'offre B" }));
    expect(
      screen.queryByRole('heading', { name: 'Laquelle coûte le moins ?' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Offre affichée' })).not.toBeInTheDocument();
    expect(within(carte('Offre B')).getByText(/Ajoutez une offre B/)).toBeInTheDocument();

    await utilisateur.click(screen.getByRole('button', { name: 'Ajouter une offre B' }));
    expect(within(carte('Offre B')).getByLabelText(/Taux nominal/)).toHaveValue('3.27');
    expect(within(carte('Offre B')).getByLabelText(/Banque/)).toHaveValue('');
    expect(screen.getByRole('heading', { name: 'Laquelle coûte le moins ?' })).toBeInTheDocument();
  });

  it('retrouve la dernière simulation à la prochaine visite', async () => {
    ecrireSimulation(window.localStorage, simulationLclCic());
    await ouvrir();
    // Le formulaire et les résultats de chaque offre portent son nom.
    expect(screen.getAllByRole('heading', { level: 2, name: 'LCL' })).toHaveLength(2);
    expect(screen.getAllByRole('heading', { level: 2, name: 'CIC' })).toHaveLength(2);
    expect(within(carte('LCL')).getByLabelText(/Durée/)).toHaveValue('25');
  });

  it('lit le lien et l’enregistre tout de suite', async () => {
    const simulation = simulationLclCic();
    await ouvrir(`/simulateur-pret${fragmentSimulation(simulation)}`);
    expect(screen.getAllByRole('heading', { level: 2, name: 'CIC' })).toHaveLength(2);
    await waitFor(() => {
      expect(lireSimulation(window.localStorage)?.offres[1]?.nom).toBe('CIC');
    });
  });

  it('un lien illisible affiche les défauts et une pastille, sans rien enregistrer', async () => {
    await ouvrir('/simulateur-pret#s=abc');
    expect(
      screen.getByText('Lien illisible : simulation par défaut affichée.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Prix affiché/)).toHaveValue('150000');
    await new Promise((resoudre) => setTimeout(resoudre, 400));
    expect(window.localStorage.getItem(CLE_SIMULATEUR)).toBeNull();
  });
});

describe('Simulateur de prêt — tableaux et sorties', () => {
  beforeEach(() => {
    ecrireSimulation(window.localStorage, simulationLclCic());
  });
  afterEach(() => {
    vi.mocked(telechargerTexte).mockClear();
  });

  it('a un onglet par offre, des années dépliables en mois, et un CSV par offre', async () => {
    const utilisateur = await ouvrir();
    const onglets = screen.getByRole('group', { name: 'Offre affichée' });
    const lcl = within(onglets).getByRole('button', { name: 'LCL' });
    const cic = within(onglets).getByRole('button', { name: 'CIC' });
    expect(lcl).toHaveAttribute('aria-pressed', 'true');
    expect(cic).toHaveAttribute('aria-pressed', 'false');
    const tableau = screen.getByRole('table', {
      name: /Tableau d'amortissement, LCL, 25 ans à 3,30 %/,
    });
    // 25 années + l'en-tête + le total.
    expect(within(tableau).getAllByRole('row')).toHaveLength(27);

    const voir = within(tableau).getByRole('button', { name: "Voir les mois de l'année 1" });
    expect(voir).toHaveAttribute('aria-expanded', 'false');
    await utilisateur.click(voir);
    const mois = screen.getByRole('table', { name: "Mois de l'année 1" });
    expect(within(mois).getAllByRole('row')).toHaveLength(13);
    expect(n(within(mois).getAllByRole('row')[1]?.textContent ?? '')).toContain('Amortissement');
    expect(
      within(tableau).getByRole('button', { name: "Masquer les mois de l'année 1" }),
    ).toHaveAttribute('aria-expanded', 'true');

    await utilisateur.click(screen.getByRole('button', { name: 'Télécharger le tableau (CSV)' }));
    expect(telechargerTexte).toHaveBeenCalledTimes(1);
    const [nom, contenu, type] = vi.mocked(telechargerTexte).mock.calls[0] ?? [];
    expect(nom).toBe('deklic-amortissement-lcl-25-ans-3-30.csv');
    expect(type).toBe('text/csv;charset=utf-8');
    expect(contenu?.charCodeAt(0)).toBe(0xfeff);
    expect(contenu).toContain('Mois;Année;Phase;');

    await utilisateur.click(cic);
    expect(cic).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('table', { name: /Tableau d'amortissement, CIC, 20 ans à 1,70 %/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: "Mois de l'année 1" })).not.toBeInTheDocument();
    await utilisateur.click(screen.getByRole('button', { name: 'Télécharger le tableau (CSV)' }));
    expect(vi.mocked(telechargerTexte).mock.calls[1]?.[0]).toBe(
      'deklic-amortissement-cic-20-ans-1-70.csv',
    );
  });

  it('copie le lien, ou l’affiche quand le presse-papiers refuse', async () => {
    const utilisateur = await ouvrir();
    const ecrire = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: ecrire },
      configurable: true,
    });
    await utilisateur.click(screen.getByRole('button', { name: 'Copier le lien' }));
    expect(await screen.findByRole('button', { name: 'Lien copié' })).toBeInTheDocument();
    expect(ecrire).toHaveBeenCalledWith(
      expect.stringMatching(/^http:\/\/localhost:3000\/simulateur-pret#s=/),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Lien copié');

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('refusé')) },
      configurable: true,
    });
    await utilisateur.click(screen.getByRole('button', { name: /Copier le lien|Lien copié/ }));
    const champ = await screen.findByLabelText('Lien de la simulation');
    expect(champ.getAttribute('value')).toMatch(/#s=/);
  });

  it('« Imprimer » ouvre le document hors coque et lance l’impression', async () => {
    const impression = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const utilisateur = await ouvrir();
    await utilisateur.click(screen.getByRole('button', { name: 'Imprimer' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Simulation de prêt' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(impression).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole('navigation', { name: 'Outils' })).not.toBeInTheDocument();
    impression.mockRestore();
  });
});
