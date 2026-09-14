import { render, screen } from '@testing-library/react';
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
import { PHRASES_ESTIMATION } from '@/textes/estimation';

const n = (s: string | null): string => (s ?? '').replace(/\s/g, ' ');
const ok = <T,>(valeur: T): Promise<Resultat<T>> => Promise.resolve({ ok: true, valeur });

const STATS = { ventes: 6, medianeM2: 3600, q1M2: 3440, q3M2: 3750, minM2: 2929, maxM2: 4000 };

/** Analyse d'adresse avec tendance : une vente de fin 2024 ramenée au 1er semestre 2025. */
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
  ventesProches: [
    {
      date: '2024-11-02',
      prix: 180000,
      surface: 60,
      prixM2: 3000,
      prixM2Actualise: 3048,
      coefficient: 1.0161,
      pieces: 3,
      type: 'appartement',
      adresse: '146 RUE DE L OLIVIER',
      distanceMetres: 12,
      groupes: ['meme_cote', 'rayon_100'],
    },
  ],
  tendance: {
    zone: 'commune',
    periodeReference: '2025-S1',
    evolution1an: 0.05,
    evolution2ans: null,
    points: [
      { periode: '2024-S1', ventes: 100, medianeM2: 3000, indice: 3000 },
      { periode: '2024-S2', ventes: 100, medianeM2: 3000, indice: 3100 },
      { periode: '2025-S1', ventes: 100, medianeM2: 3300, indice: 3150 },
    ],
  },
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

/** Crée le projet d'exemple, applique `modifier` au projet enregistré, puis ouvre l'onglet Estimation. */
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

const prixEstime = (): string =>
  n(screen.getAllByLabelText('Prix estimé').at(-1)?.textContent ?? '');

describe('Onglet Estimation', () => {
  it(
    'estime le bien, change d’état, désactive une correction, et le Rapport reprend la fourchette',
    { timeout: 30_000 },
    async () => {
      const id = await ouvrir();
      // T3 d'exemple : 206 733 € au centre, confiance moyenne, bon état supposé.
      expect(prixEstime()).toBe('207 000 €');
      expect(screen.getByText('Confiance moyenne')).toBeInTheDocument();
      expect(screen.getByText(PHRASES_ESTIMATION.etatSuppose)).toBeInTheDocument();
      expect(screen.getByRole('rowheader', { name: /^Étage et ascenseur/ })).toBeInTheDocument();
      expect(screen.getByText(/Source : Observatoire des charges/)).toBeInTheDocument();
      expect(screen.getByText(/Prix des actes, sans actualisation/)).toBeInTheDocument();

      const u = userEvent.setup();
      await u.click(screen.getByRole('button', { name: /^Rénové/ }));
      expect(
        await screen.findByRole('button', { name: /^Rénové/, pressed: true }),
      ).toBeInTheDocument();
      // Rénové : 3 400 × 65 × 0,991 + 10 268 = 229 279 €.
      expect(prixEstime()).toBe('229 000 €');
      const enregistre = lireProjets(window.localStorage).find((p) => p.id === id);
      expect(enregistre?.projet.bien.etat).toBe('renove');
      expect(enregistre?.projet.provenance['bien.etat']).toBe('utilisateur');

      await u.click(screen.getByRole('checkbox', { name: /Charges de copropriété/ }));
      expect(prixEstime()).toBe('219 000 €');
      expect(
        lireProjets(window.localStorage).find((p) => p.id === id)?.projet.estimation
          .correctionsIgnorees,
      ).toEqual(['charges']);
      await u.click(screen.getByRole('checkbox', { name: /Charges de copropriété/ }));
      expect(prixEstime()).toBe('229 000 €');

      render(<AppEnMemoire chemin={`/projets/${id}`} />);
      // L'onglet Estimation reste affiché au-dessus : seul le Rapport dit « · confiance moyenne (62/100). ».
      const resume = await screen.findByText(/· confiance moyenne \(/, {}, { timeout: 10_000 });
      // 229 279 € ± 8 % : 210 937 € et 247 621 €.
      expect(n(resume.textContent)).toBe(
        'Estimé entre 211 000 € et 248 000 € · confiance moyenne (62/100).',
      );
    },
  );

  it(
    'avec l’analyse de l’adresse : tendance, prix d’aujourd’hui, repère actualisé',
    { timeout: 30_000 },
    async () => {
      const id = await ouvrir(identite, CLIENT);
      const u = userEvent.setup();
      await u.type(screen.getByLabelText('Adresse du bien'), '144 rue de l’Olivier');
      await u.click(screen.getByRole('button', { name: 'Analyser' }));
      expect(
        await screen.findByRole(
          'heading',
          { name: "L'évolution des prix ici" },
          { timeout: 10_000 },
        ),
      ).toBeInTheDocument();
      expect(n(screen.getByText(/par l’évolution de la commune/).textContent)).toBe(
        'Prix ramenés au 1er semestre 2025 par l’évolution de la commune : +5,0 % sur un an.',
      );
      expect(
        screen.getByRole('columnheader', { name: "Au prix d'aujourd'hui" }),
      ).toBeInTheDocument();
      expect(screen.getByText(/3\s048/)).toBeInTheDocument();

      await u.click(screen.getByRole('button', { name: "Utiliser ce repère pour l'estimation" }));
      expect(await screen.findByText(/Ventes ramenées au 1er semestre 2025/)).toBeInTheDocument();
      expect(lireProjets(window.localStorage).find((p) => p.id === id)?.projet.marche.dvf).toEqual({
        medianM2: 3600,
        q1M2: 3440,
        q3M2: 3750,
        nombreVentes: 6,
        rayonMetres: 90,
        precision: 'rue',
        actualiseAu: '2025-S1',
      });
    },
  );

  it('sans ventes : invite à analyser l’adresse', { timeout: 30_000 }, async () => {
    await ouvrir((p) => ({ ...p, projet: { ...p.projet, marche: { risques: [] } } }));
    expect(screen.getByText(PHRASES_ESTIMATION.sansVentes)).toBeInTheDocument();
  });

  it('sans étage connu et charges estimées : aucune correction', { timeout: 30_000 }, async () => {
    await ouvrir((p) => ({
      ...p,
      projet: {
        ...p.projet,
        bien: { ...p.projet.bien, etage: undefined },
        provenance: { ...p.projet.provenance, 'charges.coproAnnuel': 'estime' },
      },
    }));
    expect(screen.getByText(PHRASES_ESTIMATION.aucuneCorrection)).toBeInTheDocument();
  });
});
