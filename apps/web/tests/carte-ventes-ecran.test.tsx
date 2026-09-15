import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import {
  clientHorsLigne,
  type ClientWorker,
  type ReponseAdresse,
  type Resultat,
} from '@/enrichissement';
import type { ProprietesCarteVentes } from '@/ecrans/adresse/CarteVentes';
import { lireProjets } from '@/stockage/projets';
import { PHRASES_CARTE } from '@/textes/carte';

// jsdom ne dessine ni SVG ni tuiles : Leaflet est remplacé ici, la vraie carte est prouvée par Playwright.
vi.mock('@/ecrans/adresse/CarteVentes', () => ({
  default: ({ lat, lon, points, libelle }: ProprietesCarteVentes) => (
    <div
      role="img"
      aria-label={libelle}
      data-centre={`${String(lat)},${String(lon)}`}
      data-classes={points.map((p) => p.classe).join(',')}
    />
  ),
}));

const n = (s: string | null): string => (s ?? '').replace(/\s/g, ' ');
const ok = <T,>(valeur: T): Promise<Resultat<T>> => Promise.resolve({ ok: true, valeur });

const STATS = { ventes: 6, medianeM2: 3600, q1M2: 3440, q3M2: 3750, minM2: 2929, maxM2: 4000 };

const point = (
  prixM2Corrige: number,
  distanceMetres: number,
): NonNullable<ReponseAdresse['ventesCarte']>[number] => ({
  lat: 43.2949,
  lon: 5.3939,
  date: '2025-03-01',
  prix: 210_000,
  surface: 58,
  prixM2Corrige,
  distanceMetres,
  groupes: ['rayon_100'],
});

const ANALYSE: ReponseAdresse = {
  codeInsee: '13205',
  millesime: '2025',
  parcelle: null,
  parcellesVoisines: [],
  cadastre: 'ok',
  ventesCommune: 10,
  groupes: [
    { code: 'meme_cote', ventes: 6, comparables: 6, statistiques: STATS, distanceMaxMetres: 90 },
  ],
  reference: { code: 'meme_cote', rayonMetres: 90, statistiques: STATS },
  ventesProches: [],
  tendance: null,
  sources: [],
  ventesCarte: [point(3200, 12), point(3600, 40), point(3900, 150)],
};

function client(analyse: ReponseAdresse): ClientWorker {
  return {
    ...clientHorsLigne,
    geocoder: () =>
      ok({
        libelle: "144 Rue de l'olivier 13005 Marseille",
        lat: 43.294813,
        lon: 5.393807,
        precision: 'adresse',
        cleBan: '13205_6659_00144',
        codeInsee: '13205',
        codePostal: '13005',
      }),
    analyserAdresse: () => ok(analyse),
  };
}

async function analyser(analyse: ReponseAdresse): Promise<void> {
  render(<AppEnMemoire chemin="/projets" />);
  await screen.findByRole('heading', { name: 'Mes projets' });
  const id = lireProjets(window.localStorage)[0]?.id;
  if (id === undefined) throw new Error('aucun projet');
  render(<AppEnMemoire chemin={`/projets/${id}/adresse`} client={client(analyse)} />);
  await screen.findByRole('heading', { name: /l'adresse exacte/ });
  const u = userEvent.setup();
  await u.type(screen.getByLabelText('Adresse du bien'), '144 rue de l’Olivier');
  await u.click(screen.getByRole('button', { name: 'Analyser' }));
  await screen.findByRole(
    'heading',
    { name: 'Les ventes, du plus près au plus large' },
    { timeout: 10_000 },
  );
}

describe('Carte des ventes dans l’onglet Estimation', () => {
  it(
    'montre la carte centrée sur l’adresse, ses points classés, sa légende et la mention de l’IGN',
    { timeout: 30_000 },
    async () => {
      await analyser(ANALYSE);
      const titre = await screen.findByRole('heading', { name: PHRASES_CARTE.titre });
      const carte = titre.closest('section');
      if (carte === null) throw new Error('carte introuvable');
      expect(carte).toHaveClass('print:hidden');
      expect(n(within(carte).getByText(/ventes comparables à 300 m/).textContent)).toContain(
        '3 ventes comparables à 300 m au plus',
      );
      const legende = within(carte).getByRole('list', { name: 'Légende de la carte' });
      expect(
        within(legende)
          .getAllByRole('listitem')
          .map((li) => n(li.textContent)),
      ).toEqual([
        'Le bien',
        'Moins de 3 440 €/m²',
        'Entre 3 440 €/m² et 3 750 €/m²',
        'Plus de 3 750 €/m²',
      ]);
      const image = await within(carte).findByRole('img', {
        name: 'Carte des ventes comparables autour du bien : 3 points.',
      });
      expect(image).toHaveAttribute('data-centre', '43.294813,5.393807');
      expect(image).toHaveAttribute('data-classes', 'bas,milieu,haut');
    },
  );

  it(
    'sans vente géolocalisée ou avec un Worker d’avant la carte : pas de carte',
    { timeout: 30_000 },
    async () => {
      await analyser({ ...ANALYSE, ventesCarte: undefined });
      expect(screen.queryByRole('heading', { name: PHRASES_CARTE.titre })).not.toBeInTheDocument();
    },
  );
});
