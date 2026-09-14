import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import {
  clientHorsLigne,
  type ClientWorker,
  type ReponseAdresse,
  type Resultat,
} from '@/enrichissement';
import { ecrireProjets, lireProjets, type ProjetEnregistre } from '@/stockage/projets';
import { PHRASES_CONFIANCE } from '@/textes/confiance';

const n = (s: string | null): string => (s ?? '').replace(/\s/g, ' ');
const ok = <T,>(valeur: T): Promise<Resultat<T>> => Promise.resolve({ ok: true, valeur });

const STATS = { ventes: 6, medianeM2: 3600, q1M2: 3440, q3M2: 3750, minM2: 2929, maxM2: 4000 };

/** Analyse du 144 rue de l'Olivier : repère « même côté », période et ancienneté connues. */
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
  reference: {
    code: 'meme_cote',
    rayonMetres: 90,
    statistiques: STATS,
    dateMediane: '2025-12-01',
    periode: { debut: '2025-03-01', fin: '2026-06-15' },
    ancienneteMedianeMois: 9,
  },
  ventesProches: [],
  tendance: null,
  sources: [],
};

const CLIENT: ClientWorker = {
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
  analyserAdresse: () => ok(ANALYSE),
};

const identite = (p: ProjetEnregistre): ProjetEnregistre => p;

/** Crée le projet d'exemple, le modifie, puis ouvre l'onglet Estimation. */
async function ouvrir(
  modifier: (p: ProjetEnregistre) => ProjetEnregistre = identite,
  client: ClientWorker = clientHorsLigne,
): Promise<string> {
  render(<AppEnMemoire chemin="/projets" />);
  await screen.findByRole('heading', { name: 'Mes projets' });
  const [premier, ...autres] = lireProjets(window.localStorage);
  if (premier === undefined) throw new Error('aucun projet');
  ecrireProjets(window.localStorage, [modifier(premier), ...autres]);
  render(<AppEnMemoire chemin={`/projets/${premier.id}/adresse`} client={client} />);
  await screen.findByRole('heading', { name: /l'adresse exacte/ });
  return premier.id;
}

const raisons = (): HTMLElement[] =>
  within(screen.getByRole('list', { name: 'Les raisons de la note' })).getAllByRole('listitem');

describe('Carte Confiance et carte Le repère utilisé', () => {
  it(
    'projet d’exemple : note moyenne expliquée, repère de quartier sans lieu ni période',
    { timeout: 30_000 },
    async () => {
      await ouvrir();
      const cartes = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
      expect(cartes.indexOf(PHRASES_CONFIANCE.titre)).toBe(0);
      expect(screen.getByText('Confiance moyenne · 62 sur 100')).toBeInTheDocument();
      const lignes = raisons().map((li) => n(li.textContent));
      expect(lignes).toHaveLength(4);
      expect(lignes[0]).toBe('Localisation du repère12/35Ventes du quartier, à 500 m au plus.');
      expect(lignes[1]).toContain('20/20');
      expect(lignes[1]).toContain('31 ventes comparables');
      expect(lignes[2]).toContain('Prix assez dispersés');
      expect(lignes[3]).toContain('supposée au milieu de la fenêtre');
      expect(screen.queryByText(PHRASES_CONFIANCE.affiner)).not.toBeInTheDocument();

      expect(screen.getByRole('heading', { name: PHRASES_CONFIANCE.titreRepere })).toBeVisible();
      expect(n(screen.getByText(/Appartements vendus/).textContent)).toBe(
        'Appartements vendus : 31 ventes, médiane 3 050 €/m², la moitié des ventes entre 2 700 €/m² et 3 400 €/m².',
      );
      expect(n(screen.getByText(/Prix affiché/).textContent)).toBe(
        'Prix affiché : 2 385 €/m² (155 000 €). Soit −22 % par rapport à la médiane.',
      );
      expect(screen.queryByText(PHRASES_CONFIANCE.moinsPrecis)).not.toBeInTheDocument();
    },
  );

  it(
    'repère de commune posé à la création : lieu, période, « moins précis », donnée publique, invitation',
    { timeout: 30_000 },
    async () => {
      await ouvrir((p) => ({
        ...p,
        projet: {
          ...p.projet,
          marche: {
            ...p.projet.marche,
            dvf: {
              medianM2: 3423,
              q1M2: 2833,
              q3M2: 4135,
              nombreVentes: 1823,
              precision: 'commune',
              lieu: 'Marseille 5e Arrondissement',
              periode: { debut: '2024-01-01', fin: '2025-12-31' },
              ancienneteMedianeMois: 20,
            },
          },
          provenance: { ...p.projet.provenance, 'marche.dvf.medianM2': 'dvf' },
        },
      }));
      expect(screen.getByText('Confiance faible · 36 sur 100')).toBeInTheDocument();
      const lignes = raisons().map((li) => n(li.textContent));
      expect(lignes[0]).toContain('Repère à l’échelle de la commune, sans adresse précise.');
      expect(lignes[0]).toContain('4/35');
      expect(lignes[3]).toBe('Ancienneté des ventes6/15Ventes vieilles de 20 mois en médiane.');
      expect(screen.getByText(PHRASES_CONFIANCE.affiner)).toBeInTheDocument();
      expect(n(screen.getByText(/Appartements vendus/).textContent)).toContain(
        'à Marseille 5e Arrondissement : 1 823 ventes entre janvier 2024 et décembre 2025',
      );
      expect(screen.getByText(PHRASES_CONFIANCE.moinsPrecis)).toBeInTheDocument();
      expect(screen.getByText('donnée publique')).toBeInTheDocument();
    },
  );

  it('repère saisi à la main : provenance « à toi »', { timeout: 30_000 }, async () => {
    await ouvrir((p) => ({
      ...p,
      projet: {
        ...p.projet,
        marche: { ...p.projet.marche, dvf: { medianM2: 3000, nombreVentes: 40 } },
        provenance: { ...p.projet.provenance, 'marche.dvf.medianM2': 'utilisateur' },
      },
    }));
    expect(screen.getByText('à toi')).toBeInTheDocument();
    expect(screen.getByText('Confiance faible · 35 sur 100')).toBeInTheDocument();
    expect(raisons().map((li) => n(li.textContent))[2]).toContain('Dispersion inconnue');
    expect(screen.getByText(PHRASES_CONFIANCE.moinsPrecis)).toBeInTheDocument();
  });

  it('sans repère : les deux cartes le disent', { timeout: 30_000 }, async () => {
    await ouvrir((p) => ({ ...p, projet: { ...p.projet, marche: { risques: [] } } }));
    expect(screen.getAllByText(PHRASES_CONFIANCE.sansRepere)).toHaveLength(2);
    expect(screen.queryByRole('list', { name: 'Les raisons de la note' })).not.toBeInTheDocument();
  });

  it(
    'après l’analyse et « Utiliser ce repère » : la note suit le repère de la rue, la carte Repère disparaît',
    { timeout: 30_000 },
    async () => {
      const id = await ouvrir(identite, CLIENT);
      const u = userEvent.setup();
      await u.type(screen.getByLabelText('Adresse du bien'), '144 rue de l’Olivier');
      await u.click(screen.getByRole('button', { name: 'Analyser' }));
      await u.click(
        await screen.findByRole(
          'button',
          { name: "Utiliser ce repère pour l'estimation" },
          { timeout: 10_000 },
        ),
      );
      // Rue 30 + 6 ventes 5 + dispersion 8,6 % → 30 + 9 mois → 13 = 78, bonne.
      expect(await screen.findByText('Confiance bonne · 78 sur 100')).toBeInTheDocument();
      const lignes = raisons().map((li) => n(li.textContent));
      expect(lignes[0]).toBe('Localisation du repère30/35Ventes de la même rue, à 90 m au plus.');
      expect(lignes[3]).toBe('Ancienneté des ventes13/15Ventes vieilles de 9 mois en médiane.');
      expect(
        screen.queryByRole('heading', { name: PHRASES_CONFIANCE.titreRepere }),
      ).not.toBeInTheDocument();
      expect(lireProjets(window.localStorage).find((p) => p.id === id)?.projet.marche.dvf).toEqual({
        medianM2: 3600,
        q1M2: 3440,
        q3M2: 3750,
        nombreVentes: 6,
        rayonMetres: 90,
        precision: 'rue',
        periode: { debut: '2025-03-01', fin: '2026-06-15' },
        ancienneteMedianeMois: 9,
      });
    },
  );
});
