import { calculerProjet, estimerTravaux, obtenirRegles, projetExemple } from '@loupe/moteur';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { construireProjet, type SaisieProjet } from '@/annonces';
import { AppEnMemoire } from '@/App';
import { descripteurParChemin, appliquerSaisie, CHEMIN_CHOIX_TRAVAUX } from '@/hypotheses';
import { creerProjet, ecrireProjets, lireProjets, type ProjetEnregistre } from '@/stockage/projets';
import {
  fourchetteTravaux,
  libelleLigneTravaux,
  libelleTravauxCout,
  phraseTravauxEtat,
} from '@/textes/travaux';

const regles = obtenirRegles('2026-09');
/** Les espaces insécables des nombres formatés deviennent des espaces simples. */
const n = (s: string | null | undefined): string => (s ?? '').replace(/\s/g, ' ');

const MINIMAL: SaisieProjet = {
  prix: 120_000,
  surface: 40,
  codePostal: '69003',
  ville: 'Lyon',
  mode: 'meuble',
  provenance: {},
};

/** Le T3 d'exemple (65 m², DPE D), à rafraîchir, dont les travaux suivent l'estimation. */
const suiviEstimation = {
  ...projetExemple,
  bien: { ...projetExemple.bien, etat: 'a_rafraichir' as const },
  hypotheses: {
    ...projetExemple.hypotheses,
    achat: { ...projetExemple.hypotheses.achat, travaux: 26_000, travauxChoix: 'estime' as const },
  },
};

const ok = <T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> => {
  if (!r.ok) throw new Error('saisie refusée');
  return r as Extract<T, { ok: true }>;
};

describe('création d’un projet', () => {
  it('état connu, sans travaux indiqués : 40 m² à rafraîchir → 16 000 € estimés, compris dans l’apport', () => {
    const avec = construireProjet({ ...MINIMAL, etat: 'a_rafraichir' }, 'p');
    const sans = construireProjet(MINIMAL, 'q');
    expect(avec.hypotheses.achat).toMatchObject({ travaux: 16_000, travauxChoix: 'estime' });
    expect(avec.provenance?.['achat.travaux']).toBe('estime');
    // L'apport de 10 % du coût total compte les travaux : 1 600 € de plus.
    expect((avec.hypotheses.pret.apport ?? 0) - (sans.hypotheses.pret.apport ?? 0)).toBe(1_600);
    // État inconnu : 0 €, mais le projet suivra l'état dès qu'il sera choisi.
    expect(sans.hypotheses.achat).toMatchObject({ travaux: 0, travauxChoix: 'estime' });
  });

  it('travaux indiqués : repris tels quels, « saisi »', () => {
    const p = construireProjet(
      { ...MINIMAL, etat: 'a_renover', travaux: 5_000, provenance: { travaux: 'annonce' } },
      'p',
    );
    expect(p.hypotheses.achat).toMatchObject({ travaux: 5_000, travauxChoix: 'saisi' });
    expect(p.provenance?.['achat.travaux']).toBe('annonce');
  });
});

describe('appliquerSaisie et les travaux', () => {
  it('changer l’état, la surface ou le DPE recalcule des travaux qui suivent l’estimation', () => {
    const etat = ok(
      appliquerSaisie(suiviEstimation, descripteurParChemin('bien.etat'), 'a_renover'),
    );
    expect(etat.projet.hypotheses.achat.travaux).toBe(78_000);
    expect(etat.projet.provenance?.['achat.travaux']).toBe('estime');
    const surface = ok(
      appliquerSaisie(suiviEstimation, descripteurParChemin('bien.surface'), '40'),
    );
    expect(surface.projet.hypotheses.achat.travaux).toBe(16_000);
    const dpe = ok(appliquerSaisie(suiviEstimation, descripteurParChemin('bien.dpe'), 'G'));
    expect(dpe.projet.hypotheses.achat.travaux).toBe(42_300);
    // Un autre champ du bien ne touche pas aux travaux.
    const pieces = ok(appliquerSaisie(suiviEstimation, descripteurParChemin('bien.pieces'), '4'));
    expect(pieces.projet.hypotheses.achat.travaux).toBe(26_000);
  });

  it('saisir un montant le fige ; le choix « estime » le remet ; un choix inconnu est refusé', () => {
    const saisi = ok(
      appliquerSaisie(suiviEstimation, descripteurParChemin('hypotheses.achat.travaux'), '5000'),
    );
    expect(saisi.projet.hypotheses.achat).toMatchObject({ travaux: 5_000, travauxChoix: 'saisi' });
    const fige = ok(appliquerSaisie(saisi.projet, descripteurParChemin('bien.etat'), 'a_renover'));
    expect(fige.projet.hypotheses.achat.travaux).toBe(5_000);

    const choix = { chemin: CHEMIN_CHOIX_TRAVAUX, libelle: 'Travaux', type: 'enum' } as const;
    const haut = ok(appliquerSaisie(saisi.projet, choix, 'haut'));
    expect(haut.projet.hypotheses.achat).toMatchObject({ travaux: 45_500, travauxChoix: 'haut' });
    expect(appliquerSaisie(saisi.projet, choix, 'devis')).toEqual({
      ok: false,
      erreur: 'Choix de travaux inconnu.',
    });
  });

  it('un projet d’avant la feature (sans choix) garde ses travaux', () => {
    const r = ok(appliquerSaisie(projetExemple, descripteurParChemin('bien.etat'), 'a_renover'));
    expect(r.projet.hypotheses.achat.travaux).toBe(6_000);
  });
});

describe('textes des travaux', () => {
  it('détaillent le calcul, la fourchette et la mention hors aides', () => {
    const e = estimerTravaux({ surface: 65, etat: 'a_rafraichir', dpe: 'F' }, regles);
    if (e === null) throw new Error('estimation attendue');
    expect(e.lignes.map((l) => n(libelleLigneTravaux(l, e)))).toEqual([
      'À rafraîchir · 65 m² × 400 €/m²',
      'DPE F : rénovation énergétique · 65 m² × 250 €/m²',
    ]);
    expect(n(fourchetteTravaux(e))).toBe('Fourchette 22 800 € à 78 000 €');
    expect(n(phraseTravauxEtat(e))).toBe(
      'Travaux estimés pour cet état : 42 300 € (fourchette 22 800 € à 78 000 €). Hors aides, à confirmer par devis.',
    );
    const bon = estimerTravaux({ surface: 65, etat: 'bon_etat' }, regles);
    expect(n(phraseTravauxEtat(bon))).toBe(
      "Travaux estimés pour cet état : aucun (jusqu'à 9 800 €). Hors aides, à confirmer par devis.",
    );
    expect(phraseTravauxEtat(null)).toBeNull();
    // Garde-fou : une ligne énergétique sans classe connue n'écrit pas « undefined ».
    const [, energie] = e.lignes;
    if (energie === undefined) throw new Error('ligne énergétique attendue');
    expect(n(libelleLigneTravaux(energie, { ...e, dpe: null }))).toBe(
      'DPE  : rénovation énergétique · 65 m² × 250 €/m²',
    );
    expect(libelleTravauxCout(undefined)).toBe('Travaux');
    expect(libelleTravauxCout('saisi')).toBe('Travaux');
    expect(libelleTravauxCout('bas')).toBe('Travaux estimés');
  });
});

describe('carte « L’achat » : travaux estimés', () => {
  it('tuiles Bas · Estimé · Haut, saisie « à toi », puis « Revenir à l’estimation »', async () => {
    ecrireProjets(window.localStorage, [
      creerProjet({ source: suiviEstimation, genererId: () => 'rafraichir' }),
    ]);
    render(<AppEnMemoire chemin="/projets/rafraichir/hypotheses" />);
    await screen.findByRole('heading', { name: 'Vos hypothèses' });
    const enregistre = (): ProjetEnregistre['projet'] =>
      lireProjets(window.localStorage)[0]!.projet;
    const groupe = screen.getByRole('group', { name: 'Travaux estimés' });
    expect(n(groupe.textContent)).toContain('À rafraîchir · 65 m² × 400 €/m²');
    expect(n(groupe.textContent)).toContain('Hors aides, à confirmer par devis.');
    const utilisateur = userEvent.setup();

    expect(screen.getByRole('button', { name: /^Estimé/ })).toHaveAttribute('aria-pressed', 'true');
    await utilisateur.click(screen.getByRole('button', { name: /^Haut/ }));
    expect(enregistre().hypotheses.achat).toMatchObject({ travaux: 45_500, travauxChoix: 'haut' });
    expect(screen.queryByRole('button', { name: "Revenir à l'estimation" })).toBeNull();

    const champ = screen.getByRole('textbox', { name: /^Travaux/ });
    await utilisateur.clear(champ);
    await utilisateur.type(champ, '5000');
    expect(enregistre().hypotheses.achat).toMatchObject({ travaux: 5_000, travauxChoix: 'saisi' });
    expect(enregistre().provenance['achat.travaux']).toBe('utilisateur');
    expect(screen.getByText(/ne suit plus l’état du bien/)).toBeInTheDocument();

    await utilisateur.click(screen.getByRole('button', { name: "Revenir à l'estimation" }));
    expect(enregistre().hypotheses.achat).toMatchObject({
      travaux: 26_000,
      travauxChoix: 'estime',
    });
    expect(calculerProjet(enregistre()).travaux?.estime).toBe(26_000);
  });

  it('onglet Estimation : la phrase des travaux suit l’état choisi, et les travaux aussi', async () => {
    ecrireProjets(window.localStorage, [
      creerProjet({ source: suiviEstimation, genererId: () => 'estimation' }),
    ]);
    render(<AppEnMemoire chemin="/projets/estimation/adresse" />);
    await screen.findByRole('heading', { name: /l'adresse exacte/ });
    expect(screen.getByText(/^Travaux estimés pour cet état : 26/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: /^À rénover/ }));
    expect(await screen.findByText(/^Travaux estimés pour cet état : 78/)).toBeInTheDocument();
    expect(lireProjets(window.localStorage)[0]?.projet.hypotheses.achat.travaux).toBe(78_000);
  });

  it('sans état connu : une phrase invite à l’indiquer', async () => {
    ecrireProjets(window.localStorage, [
      creerProjet({ source: projetExemple, genererId: () => 'sans-etat' }),
    ]);
    render(<AppEnMemoire chemin="/projets/sans-etat/hypotheses" />);
    await screen.findByRole('heading', { name: 'Vos hypothèses' });
    expect(
      screen.getByText("Indiquez l'état du bien pour estimer les travaux."),
    ).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Travaux estimés' })).toBeNull();
  });
});
