import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { elementBulle } from '@/ecrans/adresse/bulle-vente';
import type { ProprietesCarteVentes } from '@/ecrans/adresse/CarteVentes';
import {
  cleVente,
  clientHorsLigne,
  type ClientWorker,
  type ReponseAdresse,
  type Resultat,
  type VenteCarte,
  type VenteProcheAdresse,
} from '@/enrichissement';
import { ecrireProjets, lireProjets } from '@/stockage/projets';
import { PHRASES_CARTE } from '@/textes/carte';
import { PHRASES_VENTES } from '@/textes/ventes';

// jsdom ne dessine ni SVG ni tuiles : Leaflet est remplacé ici par une carte qui expose ses propriétés et ses
// rappels ; la vraie carte (gestes, bulles, tuiles) est prouvée par Playwright (`e2e/carte.spec.ts`).
vi.mock('@/ecrans/adresse/CarteVentes', () => ({
  default: (p: ProprietesCarteVentes) => {
    const { selection } = p;
    return (
      <div
        data-testid="carte-simulee"
        data-centre={`${String(p.lat)},${String(p.lon)}`}
        data-niveaux={p.points.map((x) => x.niveau).join(',')}
        data-fond={p.fond}
        data-parcelles={String(p.parcelles)}
        data-plein-ecran={String(p.pleinEcran)}
        data-recentrage={String(p.recentrage)}
        data-selection={selection ?? ''}
        data-centrage={String(p.centrage)}
        data-rayon={String(p.rayon ?? '')}
      >
        {p.points.map((x) => (
          <button
            key={x.cle}
            type="button"
            onClick={() => {
              p.onSelection(x.cle);
            }}
          >{`Vente à ${String(x.distanceMetres)} m`}</button>
        ))}
        {selection !== null && (
          <button
            type="button"
            onClick={() => {
              p.onVoirTableau(selection);
            }}
          >
            {PHRASES_CARTE.voirTableau}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            p.onRayon(100);
          }}
        >
          Cercle de 100 m
        </button>
      </div>
    );
  },
}));

const n = (s: string | null): string => (s ?? '').replace(/\s/g, ' ');
const ok = <T,>(valeur: T): Promise<Resultat<T>> => Promise.resolve({ ok: true, valeur });
const MESSAGE_CTRL = 'Ctrl + molette pour zoomer';

const ADRESSE = {
  libelle: "144 Rue de l'Olivier 13005 Marseille",
  lat: 43.294813,
  lon: 5.393807,
  codeInsee: '13205',
  codeVoie: '6659',
  numero: 144,
  codePostal: '13005',
};

const STATS = { ventes: 25, medianeM2: 3400, q1M2: 3200, q3M2: 3600, minM2: 2950, maxM2: 3990 };

/** 25 ventes : la i-ème à 10 × i mètres, 3 000 + 40 × i €/m² ; les trois premières dans le même immeuble. */
const PROCHES: VenteProcheAdresse[] = Array.from({ length: 25 }, (_, i) => ({
  date: `2025-${String((i % 9) + 1).padStart(2, '0')}-15`,
  prix: 150_000 + i * 2_000,
  surface: 50,
  prixM2: 3000 + 40 * i,
  prixM2Corrige: 3000 + 40 * i,
  pieces: 3,
  type: 'appartement',
  adresse: `${String(i + 1)} RUE TEST`,
  distanceMetres: 10 * i,
  groupes: i < 3 ? ['meme_parcelle', 'rayon_100'] : ['rayon_300'],
  dpe: null,
}));

const SUR_CARTE: VenteCarte[] = PROCHES.map((v, i) => ({
  lat: 43.2948 + i / 10_000,
  lon: 5.3938,
  date: v.date,
  prix: v.prix,
  surface: v.surface,
  prixM2Corrige: v.prixM2Corrige ?? v.prixM2,
  distanceMetres: v.distanceMetres ?? 0,
  groupes: v.groupes,
}));

const ANALYSE: ReponseAdresse = {
  codeInsee: '13205',
  millesime: '2025',
  parcelle: null,
  parcellesVoisines: [],
  cadastre: 'ok',
  ventesCommune: 400,
  groupes: [
    { code: 'rayon_300', ventes: 25, comparables: 25, statistiques: STATS, distanceMaxMetres: 240 },
  ],
  reference: { code: 'rayon_300', rayonMetres: 240, statistiques: STATS },
  ventesProches: PROCHES,
  dpeVentes: 'ok',
  sources: [],
  ventesCarte: SUR_CARTE,
};

function vente(i: number): VenteProcheAdresse {
  const v = PROCHES[i];
  if (v === undefined) throw new Error(`vente ${String(i)} absente`);
  return v;
}

async function ouvrir(analyse: ReponseAdresse): Promise<void> {
  render(<AppEnMemoire chemin="/projets" />);
  await screen.findByRole('heading', { name: 'Mes projets' });
  const [premier, ...autres] = lireProjets(window.localStorage);
  if (premier === undefined) throw new Error('aucun projet');
  ecrireProjets(window.localStorage, [{ ...premier, adresse: ADRESSE }, ...autres]);
  const client: ClientWorker = { ...clientHorsLigne, analyserAdresse: () => ok(analyse) };
  render(<AppEnMemoire chemin={`/projets/${premier.id}/adresse`} client={client} />);
  await screen.findByRole('heading', { name: PHRASES_VENTES.titre }, { timeout: 10_000 });
}

function section(titre: string): HTMLElement {
  const element = screen.getByRole('heading', { name: titre }).closest('section');
  if (element === null) throw new Error(`section ${titre} introuvable`);
  return element;
}

describe('Carte des ventes dans l’onglet Estimation', () => {
  it(
    'région nommée, centrée sur l’adresse, pastilles colorées par prix, légende, pas d’impression',
    { timeout: 30_000 },
    async () => {
      await ouvrir(ANALYSE);
      const carte = section(PHRASES_CARTE.titre);
      expect(carte).toHaveClass('print:hidden');
      expect(n(within(carte).getByText(/ventes comparables à 300 m/).textContent)).toContain(
        '25 ventes comparables à 300 m au plus',
      );
      expect(
        within(carte).getByRole('region', {
          name: 'Carte des ventes comparables autour du bien : 25 points.',
        }),
      ).toBeInTheDocument();
      const simulee = await screen.findByTestId('carte-simulee', {}, { timeout: 10_000 });
      expect(simulee).toHaveAttribute('data-centre', '43.294813,5.393807');
      const niveaux = simulee.getAttribute('data-niveaux')?.split(',') ?? [];
      expect(niveaux.slice(0, 2)).toEqual(['bas', 'bas']);
      expect(niveaux.at(-1)).toBe('haut');
      const legende = within(carte).getByRole('list', { name: 'Légende de la carte' });
      expect(
        within(legende)
          .getAllByRole('listitem')
          .map((li) => n(li.textContent)),
      ).toEqual([
        'Le bien',
        'Moins de 3 200 €/m²',
        'Entre 3 200 €/m² et 3 600 €/m²',
        'Plus de 3 600 €/m²',
      ]);
      // Aucune vente n'a de DPE : le choix n'est pas proposé.
      expect(within(carte).queryByRole('radio', { name: 'DPE' })).not.toBeInTheDocument();
    },
  );

  it(
    'réglages : couleur par ancienneté, photo aérienne, parcelles, recentrer',
    { timeout: 30_000 },
    async () => {
      await ouvrir(ANALYSE);
      const carte = section(PHRASES_CARTE.titre);
      const simulee = await screen.findByTestId('carte-simulee', {}, { timeout: 10_000 });
      const u = userEvent.setup();
      await u.click(within(carte).getByRole('radio', { name: 'Ancienneté' }));
      expect(within(carte).getByRole('radio', { name: 'Ancienneté' })).toBeChecked();
      expect(within(carte).getByText('Plus de 3 ans')).toBeInTheDocument();
      await u.click(within(carte).getByRole('radio', { name: 'Photo aérienne' }));
      expect(simulee).toHaveAttribute('data-fond', 'photo');
      await u.click(within(carte).getByRole('checkbox', { name: PHRASES_CARTE.parcelles }));
      expect(simulee).toHaveAttribute('data-parcelles', 'true');
      await u.click(within(carte).getByRole('button', { name: PHRASES_CARTE.recentrer }));
      expect(simulee).toHaveAttribute('data-recentrage', '1');
    },
  );

  it(
    'molette sans Ctrl : message et la carte ne la reçoit pas ; avec Ctrl, la carte la reçoit',
    { timeout: 30_000 },
    async () => {
      await ouvrir(ANALYSE);
      const simulee = await screen.findByTestId('carte-simulee', {}, { timeout: 10_000 });
      const recue = vi.fn();
      simulee.addEventListener('wheel', recue);
      fireEvent.wheel(simulee, { deltaY: 100, ctrlKey: true });
      expect(recue).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(MESSAGE_CTRL)).not.toBeInTheDocument();
      vi.useFakeTimers({ shouldAdvanceTime: true });
      fireEvent.wheel(simulee, { deltaY: 100 });
      expect(recue).toHaveBeenCalledTimes(1);
      expect(screen.getByText(MESSAGE_CTRL)).toHaveAttribute('role', 'status');
      act(() => {
        vi.advanceTimersByTime(2_000);
      });
      expect(screen.queryByText(MESSAGE_CTRL)).not.toBeInTheDocument();
      vi.useRealTimers();
    },
  );

  it('plein écran : ouvert, puis fermé par Échap', { timeout: 30_000 }, async () => {
    await ouvrir(ANALYSE);
    const carte = section(PHRASES_CARTE.titre);
    const simulee = await screen.findByTestId('carte-simulee', {}, { timeout: 10_000 });
    const u = userEvent.setup();
    await u.click(within(carte).getByRole('button', { name: PHRASES_CARTE.pleinEcran }));
    const fermer = within(carte).getByRole('button', { name: PHRASES_CARTE.fermer });
    expect(simulee).toHaveAttribute('data-plein-ecran', 'true');
    expect(within(carte).getByRole('region').parentElement).toHaveClass('fixed', 'inset-0');
    // Le bouton garde le focus : il change seulement de libellé.
    expect(fermer).toHaveFocus();
    // En plein écran, la molette va à la carte, sans message.
    fireEvent.wheel(simulee, { deltaY: 100 });
    expect(screen.queryByText(MESSAGE_CTRL)).not.toBeInTheDocument();
    await u.keyboard('{Escape}');
    expect(simulee).toHaveAttribute('data-plein-ecran', 'false');
    expect(within(carte).getByRole('button', { name: PHRASES_CARTE.pleinEcran })).toHaveFocus();
  });

  it(
    'carte → tableau : « Voir dans le tableau » ouvre la page de la vente et la met en avant ; Échap ferme la fiche',
    { timeout: 30_000 },
    async () => {
      await ouvrir(ANALYSE);
      const simulee = await screen.findByTestId('carte-simulee', {}, { timeout: 10_000 });
      const u = userEvent.setup();
      await u.click(within(simulee).getByRole('button', { name: 'Vente à 220 m' }));
      expect(simulee).toHaveAttribute('data-selection', cleVente(vente(22)));
      await u.click(within(simulee).getByRole('button', { name: PHRASES_CARTE.voirTableau }));
      const tableau = section(PHRASES_VENTES.titre);
      expect(within(tableau).getByText('Page 2 sur 2')).toBeInTheDocument();
      const ligne = within(tableau).getByText('23 RUE TEST').closest('tr');
      expect(ligne).toHaveAttribute('aria-current', 'true');
      expect(ligne).toHaveFocus();
      expect(
        within(tableau)
          .getAllByRole('row')
          .filter((r) => r.hasAttribute('aria-current')),
      ).toHaveLength(1);

      await u.click(within(simulee).getByRole('button', { name: 'Vente à 10 m' }));
      await u.keyboard('{Escape}');
      expect(simulee).toHaveAttribute('data-selection', '');
    },
  );

  it(
    'tableau → carte : « Sur la carte » sélectionne et centre la vente',
    { timeout: 30_000 },
    async () => {
      await ouvrir(ANALYSE);
      const simulee = await screen.findByTestId('carte-simulee', {}, { timeout: 10_000 });
      const tableau = section(PHRASES_VENTES.titre);
      const u = userEvent.setup();
      expect(simulee).toHaveAttribute('data-centrage', '0');
      const [, deuxieme] = within(tableau).getAllByRole('button', { name: /^Sur la carte/ });
      if (deuxieme === undefined) throw new Error('bouton « Sur la carte » absent');
      await u.click(deuxieme);
      expect(simulee).toHaveAttribute('data-selection', cleVente(vente(1)));
      expect(simulee).toHaveAttribute('data-centrage', '1');
      expect(within(tableau).getByText('2 RUE TEST').closest('tr')).toHaveAttribute(
        'aria-current',
        'true',
      );
    },
  );

  it(
    'les filtres du tableau s’appliquent aux pastilles ; un cercle filtre le tableau puis se retire',
    { timeout: 30_000 },
    async () => {
      await ouvrir(ANALYSE);
      const carte = section(PHRASES_CARTE.titre);
      const simulee = await screen.findByTestId('carte-simulee', {}, { timeout: 10_000 });
      const tableau = section(PHRASES_VENTES.titre);
      const filtres = within(tableau).getByRole('group', { name: PHRASES_VENTES.filtres });
      const u = userEvent.setup();
      await u.click(within(filtres).getByRole('button', { name: 'Même immeuble' }));
      expect(within(simulee).getAllByRole('button', { name: /^Vente à/ })).toHaveLength(3);
      expect(within(carte).getByRole('region', { name: /: 3 points\.$/ })).toBeInTheDocument();
      await u.click(within(filtres).getByRole('button', { name: 'Même immeuble' }));

      await u.click(within(simulee).getByRole('button', { name: 'Cercle de 100 m' }));
      expect(simulee).toHaveAttribute('data-rayon', '100');
      expect(within(filtres).getByRole('button', { name: 'À moins de 100 m' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(n(within(filtres).getByText(/ventes ·/).textContent)).toContain('11 ventes');
      expect(within(simulee).getAllByRole('button', { name: /^Vente à/ })).toHaveLength(11);
      await u.click(within(filtres).getByRole('button', { name: 'À moins de 100 m' }));
      expect(simulee).toHaveAttribute('data-rayon', '');
      expect(within(simulee).getAllByRole('button', { name: /^Vente à/ })).toHaveLength(25);
    },
  );

  it(
    'sans vente géolocalisée ou avec un Worker d’avant la carte : pas de carte, pas de « Sur la carte »',
    { timeout: 30_000 },
    async () => {
      await ouvrir({ ...ANALYSE, ventesCarte: undefined });
      expect(screen.queryByRole('heading', { name: PHRASES_CARTE.titre })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Sur la carte/ })).not.toBeInTheDocument();
    },
  );
});

describe('bulle d’une vente', () => {
  it('construite élément par élément : le texte reste du texte', () => {
    const voir = vi.fn();
    const bulle = elementBulle(
      {
        titre: 'Vente du 1 mars 2025',
        lignes: [{ libelle: 'Adresse', valeur: '<img src=x onerror=alert(1)> RUE TEST' }],
      },
      voir,
    );
    expect(bulle.querySelector('img')).toBeNull();
    expect(bulle.querySelector('dd')?.textContent).toBe('<img src=x onerror=alert(1)> RUE TEST');
    expect(bulle.querySelector('.carte-bulle-titre')?.textContent).toBe('Vente du 1 mars 2025');
    bulle.querySelector('button')?.click();
    expect(voir).toHaveBeenCalledTimes(1);
    expect(elementBulle({ titre: 'x', lignes: [] }, null).querySelector('button')).toBeNull();
  });
});
