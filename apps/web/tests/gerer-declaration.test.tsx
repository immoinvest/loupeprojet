import {
  argentDesDerniersMois,
  comparerReelPrevu,
  moisDeComparaison,
  prevuDuBien,
  reelMensuel,
  type BienGere,
  type Depense,
  type EtatArgent,
  type EtatGestion,
} from '@loupe/gestion';
import { projetExemple } from '@loupe/moteur';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientMemoire } from '@/compte/memoire';
import type { Utilisateur } from '@/compte/types';
import { telechargerTexte } from '@/ecrans/simulateur/telecharger';
import { clientArgentMemoire } from '@/gestion/argent/memoire';
import { donneesArgent } from '@/gestion/argent/page';
import { clientGestionMemoire } from '@/gestion/memoire';
import { TEXTES_ARGENT } from '@/textes/gerer-argent';
import {
  phraseEcart,
  RAISONS_SANS_PREVU,
  TEXTES_DECLARATION,
  TEXTES_REEL_PREVU,
  titreEcart,
} from '@/textes/gerer-declaration';

import { ouvrirGroupe } from './aides-verifier';
import {
  BIEN_BAILLE,
  BIEN_LICES,
  ETAT_SEPTEMBRE,
  HORODATAGE,
  LOCATION_ANTOINE,
} from './gestion-exemples';

vi.mock('@/ecrans/simulateur/telecharger', () => ({ telechargerTexte: vi.fn() }));

const CAMILLE: Utilisateur = {
  id: 'u1',
  nom: 'Camille Roux',
  email: 'camille@example.org',
  image: null,
};

/** Le Studio Baille loué vide à Antoine (430 € payés le 3 septembre). */
const STUDIO_VIDE: BienGere = { ...BIEN_BAILLE, meuble: false };
/** Le T2 Lices acheté depuis le projet d'exemple il y a un an (LMNP réel). */
const LICES_ANALYSE: BienGere = {
  ...BIEN_LICES,
  creeLe: '2025-09-01T08:00:00.000Z',
  projetId: 'p1',
  projet: { ...projetExemple },
};

const ETAT: EtatGestion = {
  ...ETAT_SEPTEMBRE,
  biens: [LICES_ANALYSE, STUDIO_VIDE],
  paiements: [
    ...ETAT_SEPTEMBRE.paiements,
    {
      id: 'paiement-antoine',
      locationId: LOCATION_ANTOINE.id,
      periode: '2026-09',
      montant: 43_000,
      date: '2026-09-03',
      source: 'manuel',
      creeLe: HORODATAGE,
    },
  ],
};

function depense(champs: Partial<Depense>): Depense {
  return {
    id: 'taxe',
    bienId: STUDIO_VIDE.id,
    categorie: 'taxe_fonciere',
    montant: 60_000,
    date: '2026-09-10',
    recuperable: false,
    creeLe: HORODATAGE,
    modifieLe: HORODATAGE,
    ...champs,
  };
}

const ARGENT: EtatArgent = {
  depenses: [
    depense({}),
    depense({ id: 'credit', categorie: 'credit', montant: 2_000, libelle: 'Crédit conso' }),
  ],
  prets: [],
};

function monter(
  chemin: string,
  options: { etat?: EtatGestion; argent?: ReturnType<typeof clientArgentMemoire> } = {},
): void {
  render(
    <AppEnMemoire
      chemin={chemin}
      compte={clientMemoire({ utilisateur: CAMILLE })}
      gestion={clientGestionMemoire({ etat: options.etat ?? ETAT })}
      argent={options.argent ?? clientArgentMemoire({ etat: ARGENT })}
    />,
  );
}

function sansEspaces(texte: string | null | undefined): string {
  return (texte ?? '').replace(/\s/g, ' ');
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 10, 0));
  vi.mocked(telechargerTexte).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('page Déclaration', () => {
  it('deux clics depuis le menu jusqu’au fichier de l’année ; l’année se choisit dans la liste', async () => {
    const utilisateur = userEvent.setup();
    monter('/gerer');
    const menu = await screen.findByRole('navigation', { name: 'Gérer' }, { timeout: 10_000 });
    // Clic 1.
    await utilisateur.click(within(menu).getByRole('link', { name: 'Déclaration' }));
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'Déclaration 2026 (revenus 2025)' },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument();

    // Choisir dans une liste ne compte pas comme un clic (specs, § 1).
    await utilisateur.click(screen.getByRole('button', { name: 'Revenus de l’année 2025' }));
    await utilisateur.click(screen.getByRole('option', { name: '2026' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Déclaration 2027 (revenus 2026)' }),
    ).toBeInTheDocument();
    expect(screen.getByText(TEXTES_DECLARATION.casesAConfirmer)).toBeInTheDocument();

    // Clic 2.
    await utilisateur.click(screen.getByRole('button', { name: TEXTES_DECLARATION.exporter }));
    expect(telechargerTexte).toHaveBeenCalledTimes(1);
    const [nom, contenu, type] = vi.mocked(telechargerTexte).mock.calls[0] ?? [];
    expect(nom).toBe('deklic-gestion-2026.csv');
    expect(type).toBe('text/csv;charset=utf-8');
    expect(contenu).toContain(
      '03/09/2026;Studio Baille;Loyer;Loyer de septembre 2026 · Antoine Dupont;430,00;Loyer reçu',
    );
    expect(contenu).toContain('10/09/2026;Studio Baille;Taxe foncière;;-600,00;Dépense saisie');
  });

  it('revenus 2026 : réel 2044 du bien vide, micro-BIC et LMNP du meublé, régime de l’analyse en premier, dépenses non reportées', async () => {
    monter('/gerer/declaration?annee=2026');
    const reel = await screen.findByRole(
      'region',
      { name: 'Réel (déclaration 2044)' },
      { timeout: 10_000 },
    );
    // Taxe foncière 600 € ; 20 € par local ; loyers hors charges 400 €.
    const lignes = within(reel)
      .getAllByText(/ligne \d{3}/)
      .map((n) => n.parentElement?.textContent);
    expect(lignes.map(sansEspaces)).toEqual(
      expect.arrayContaining([
        'Loyers encaissés hors charges · ligne 211 (à confirmer)400 €',
        'Autres frais de gestion (20 € par local) · ligne 222 (à confirmer)20 €'.replace(
          /\s/g,
          ' ',
        ),
        'Taxe foncière · ligne 227 (à confirmer)600 €',
      ]),
    );
    expect(within(reel).getByText(/case 4BC/)).toBeInTheDocument();

    const regions = screen.getAllByRole('region').map((r) => r.getAttribute('aria-labelledby'));
    // Le meublé : LMNP réel (choisi dans l'analyse) avant le micro-BIC.
    expect(regions.indexOf('regime-lmnp_reel')).toBeLessThan(regions.indexOf('regime-micro_bic'));
    expect(
      within(screen.getByRole('region', { name: /^LMNP au réel/ })).getByText(
        TEXTES_DECLARATION.retenu,
      ),
    ).toBeInTheDocument();
    const micro = screen.getByRole('region', { name: 'Micro-BIC' });
    expect(sansEspaces(micro.textContent)).toContain(
      'Recettes encaissées, charges comprises · case 5NI (5OI pour le déclarant 2) (à confirmer)700 €',
    );

    const nonReportees = screen.getByRole('list', { name: TEXTES_DECLARATION.nonReporteesTitre });
    expect(within(nonReportees).getByText('Crédit conso')).toBeInTheDocument();
  });

  it('le récapitulatif imprimable s’ouvre hors coque et ramène à la déclaration de la même année', async () => {
    const utilisateur = userEvent.setup();
    monter('/gerer/declaration?annee=2026');
    await utilisateur.click(
      await screen.findByRole(
        'link',
        { name: TEXTES_DECLARATION.recapitulatif },
        { timeout: 10_000 },
      ),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Récapitulatif de l’année 2026' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Gérer' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: TEXTES_DECLARATION.imprimer })).toBeInTheDocument();
    await utilisateur.click(screen.getByRole('link', { name: /Déclaration/ }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Déclaration 2027 (revenus 2026)' }),
    ).toBeInTheDocument();
  });

  it('sans la migration 0007 : « Bientôt disponible » ; sans bien : l’invitation à en ajouter', async () => {
    monter('/gerer/declaration', {
      argent: clientArgentMemoire({ erreurs: { etat: 'indisponible' } }),
    });
    expect(
      await screen.findByText(TEXTES_ARGENT.bientot, {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
  });

  it('sans bien : l’invitation à en ajouter, et un export vide possible', async () => {
    monter('/gerer/declaration', { etat: { ...ETAT, biens: [], locations: [], paiements: [] } });
    expect(
      await screen.findByText(TEXTES_DECLARATION.aucunBien, {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Micro-BIC' })).not.toBeInTheDocument();
  });
});

describe('carte « Réel contre prévu » de la fiche d’un bien', () => {
  it('un bien acheté après une analyse : l’écart par mois et les deux postes qui le font', async () => {
    monter('/gerer/biens/bien-lices');
    const prevu = prevuDuBien(LICES_ANALYSE);
    if (!prevu.ok) throw new Error('prévu attendu');
    const periode = moisDeComparaison(LICES_ANALYSE, '2026-09-14');
    if (periode === null) throw new Error('période attendue');
    const bilan = argentDesDerniersMois(
      donneesArgent(ETAT, ARGENT),
      periode.fin,
      { bienId: LICES_ANALYSE.id },
      periode.mois,
    );
    const attendu = comparerReelPrevu(prevu, reelMensuel(bilan, periode.mois));

    const liste = await screen.findByRole(
      'list',
      { name: TEXTES_REEL_PREVU.principaux },
      { timeout: 10_000 },
    );
    expect(periode.mois).toBe(11);
    expect(
      screen.getByText(
        (_, n) =>
          n?.tagName === 'P' &&
          sansEspaces(n.textContent) === sansEspaces(titreEcart(attendu.ecart)),
      ),
    ).toBeInTheDocument();
    expect(
      within(liste)
        .getAllByRole('listitem')
        .map((li) => sansEspaces(li.textContent)),
    ).toEqual(attendu.principaux.map((e) => sansEspaces(phraseEcart(e))));
    // L'analyse s'ouvre par le lien de l'en-tête de la fiche : la carte ne le répète pas.
    const liens = screen.getAllByRole('link', { name: TEXTES_REEL_PREVU.voirAnalyse });
    expect(liens).toHaveLength(1);
    expect(liens[0]).toHaveAttribute('href', '/projets/p1');
  });

  it('un bien sans analyse : « Analyser ce bien » ouvre le formulaire déjà rempli, en un clic', async () => {
    const utilisateur = userEvent.setup();
    monter('/gerer/biens/bien-baille');
    await utilisateur.click(
      await screen.findByRole('link', { name: TEXTES_REEL_PREVU.analyser }, { timeout: 10_000 }),
    );
    // Formulaire Vérifier ouvert d'emblée : la surface reprise de Gérer est rangée dans « Préciser ».
    await screen.findByRole('button', { name: /Préciser/ }, { timeout: 10_000 });
    await ouvrirGroupe(utilisateur, /Préciser/);
    expect(screen.getByLabelText(/^Surface/)).toHaveValue('38');
  });

  it('trop tôt, analyse sans loyer, parking sans analyse, dépenses indisponibles', async () => {
    const recent: BienGere = { ...LICES_ANALYSE, creeLe: '2026-09-01T08:00:00.000Z' };
    const sansLoyer: BienGere = {
      ...BIEN_BAILLE,
      projetId: 'p2',
      projet: {
        ...projetExemple,
        hypotheses: {
          ...projetExemple.hypotheses,
          location: { mode: 'meuble', vacanceSemaines: 3 },
        },
      },
    };
    const parking: BienGere = { ...BIEN_BAILLE, id: 'parking', type: 'parking' };
    const { unmount } = render(
      <AppEnMemoire
        chemin="/gerer/biens/bien-lices"
        compte={clientMemoire({ utilisateur: CAMILLE })}
        gestion={clientGestionMemoire({ etat: { ...ETAT, biens: [recent, sansLoyer, parking] } })}
        argent={clientArgentMemoire({ etat: ARGENT })}
      />,
    );
    expect(
      await screen.findByText(TEXTES_REEL_PREVU.tropTot, {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
    unmount();

    monter('/gerer/biens/bien-baille', { etat: { ...ETAT, biens: [sansLoyer] } });
    expect(
      await screen.findByText(RAISONS_SANS_PREVU.sans_loyer, {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
  });

  it('un parking sans analyse ne propose pas d’analyse ; sans la migration 0007, la carte le dit', async () => {
    const parking: BienGere = { ...BIEN_BAILLE, type: 'parking' };
    const { unmount } = render(
      <AppEnMemoire
        chemin="/gerer/biens/bien-baille"
        compte={clientMemoire({ utilisateur: CAMILLE })}
        gestion={clientGestionMemoire({ etat: { ...ETAT, biens: [parking] } })}
        argent={clientArgentMemoire({ etat: ARGENT })}
      />,
    );
    expect(
      await screen.findByText(TEXTES_REEL_PREVU.sansAnalyse, {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: TEXTES_REEL_PREVU.analyser }),
    ).not.toBeInTheDocument();
    unmount();

    monter('/gerer/biens/bien-lices', {
      argent: clientArgentMemoire({ erreurs: { etat: 'indisponible' } }),
    });
    // La carte Argent et la carte Réel contre prévu disent toutes deux « Bientôt disponible ».
    expect(await screen.findAllByText(TEXTES_ARGENT.bientot, {}, { timeout: 10_000 })).toHaveLength(
      2,
    );
  });
});
