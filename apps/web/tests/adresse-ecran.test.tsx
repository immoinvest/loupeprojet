import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import {
  clientHorsLigne,
  type ClientWorker,
  type ReponseAdresse,
  type Resultat,
  type ResultatGeocodage,
} from '@/enrichissement';
import { lireProjets } from '@/stockage/projets';
import { PHRASES_ADRESSE } from '@/textes/adresse';

const n = (s: string | null): string => (s ?? '').replace(/\s/g, ' ');
const ok = <T,>(valeur: T): Promise<Resultat<T>> => Promise.resolve({ ok: true, valeur });
const echec = <T,>(): Promise<Resultat<T>> => Promise.resolve({ ok: false, code: 'RESEAU' });

const LIEU: ResultatGeocodage = {
  libelle: "144 Rue de l'olivier 13005 Marseille",
  lat: 43.294813,
  lon: 5.393807,
  precision: 'adresse',
  cleBan: '13205_6659_00144',
  codeInsee: '13205',
  codePostal: '13005',
};

const STATS = { ventes: 6, medianeM2: 3600, q1M2: 3440, q3M2: 3750, minM2: 2929, maxM2: 4000 };

/** Réponse du Worker pour le 144 rue de l'Olivier (valeurs du test d'analyse du Worker). */
const ANALYSE: ReponseAdresse = {
  codeInsee: '13205',
  millesime: '2025',
  parcelle: '132058200E0318',
  parcellesVoisines: ['132058200E0319'],
  cadastre: 'ok',
  ventesCommune: 10,
  groupes: [
    {
      code: 'meme_parcelle',
      ventes: 2,
      comparables: 2,
      statistiques: { ...STATS, ventes: 2, medianeM2: 3800 },
      distanceMaxMetres: 0,
    },
    {
      code: 'parcelles_voisines',
      ventes: 0,
      comparables: 0,
      statistiques: null,
      distanceMaxMetres: null,
    },
    { code: 'meme_cote', ventes: 6, comparables: 6, statistiques: STATS, distanceMaxMetres: 90 },
    {
      code: 'en_face',
      ventes: 1,
      comparables: 1,
      statistiques: { ...STATS, ventes: 1 },
      distanceMaxMetres: 18,
    },
    {
      code: 'rayon_100',
      ventes: 7,
      comparables: 7,
      statistiques: { ...STATS, ventes: 7 },
      distanceMaxMetres: 90,
    },
    {
      code: 'rayon_200',
      ventes: 8,
      comparables: 8,
      statistiques: { ...STATS, ventes: 8 },
      distanceMaxMetres: 150,
    },
    {
      code: 'rayon_300',
      ventes: 9,
      comparables: 8,
      statistiques: { ...STATS, ventes: 8 },
      distanceMaxMetres: 150,
    },
  ],
  reference: { code: 'meme_cote', rayonMetres: 90, statistiques: STATS },
  ventesProches: [
    {
      date: '2025-03-01',
      prix: 240000,
      surface: 60,
      prixM2: 4000,
      pieces: 3,
      type: 'appartement',
      adresse: '144 RUE DE L OLIVIER',
      distanceMetres: 0,
      groupes: ['meme_parcelle', 'meme_cote', 'rayon_100'],
    },
    {
      date: '2024-11-02',
      prix: 234000,
      surface: 65,
      prixM2: 3600,
      pieces: 3,
      type: 'appartement',
      adresse: null,
      distanceMetres: null,
      groupes: ['meme_parcelle'],
    },
  ],
  sources: [
    {
      nom: 'Demandes de valeurs foncières géolocalisées (Etalab, à partir des données DGFiP)',
      url: 'https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres-geolocalisees',
      licence: 'Licence Ouverte 2.0',
    },
  ],
};

async function ouvrir(client: ClientWorker): Promise<string> {
  render(<AppEnMemoire chemin="/projets" />);
  await screen.findByRole('heading', { name: 'Mes projets' });
  const id = lireProjets(window.localStorage)[0]?.id ?? '';
  render(<AppEnMemoire chemin={`/projets/${id}/adresse`} client={client} />);
  await screen.findByRole('heading', { name: /l'adresse exacte/ });
  return id;
}

describe('Onglet Adresse', () => {
  it(
    'situe l’adresse, affiche les groupes et le repère, puis l’applique au verdict',
    { timeout: 30_000 },
    async () => {
      const demandes: unknown[] = [];
      const client: ClientWorker = {
        ...clientHorsLigne,
        geocoder: (recherche) => {
          demandes.push(recherche);
          return ok(LIEU);
        },
        analyserAdresse: (parametres) => {
          demandes.push(parametres);
          return ok(ANALYSE);
        },
      };
      await ouvrir(client);
      const u = userEvent.setup();
      await u.type(
        screen.getByLabelText('Adresse du bien'),
        "144 rue de l'Olivier 13005 Marseille",
      );
      await u.click(screen.getByRole('button', { name: 'Analyser' }));

      // Exemple : 155 000 € / 65 m² = 2 385 €/m², soit −34 % sous la médiane de 3 600 €/m².
      const phrase = await screen.findByText(
        /Même côté de la rue : 6 ventes comparables/,
        {},
        { timeout: 10_000 },
      );
      expect(n(phrase.textContent)).toContain('médiane 3 600 €/m². Ce bien est à −34 %.');
      expect(demandes).toEqual([
        "144 rue de l'Olivier 13005 Marseille",
        {
          codeInsee: '13205',
          lat: 43.294813,
          lon: 5.393807,
          numero: 144,
          codeVoie: '6659',
          type: 'appartement',
          surface: 65,
        },
      ]);
      expect(lireProjets(window.localStorage)[0]?.adresse).toEqual({
        libelle: LIEU.libelle,
        lat: 43.294813,
        lon: 5.393807,
        codeInsee: '13205',
        codeVoie: '6659',
        numero: 144,
      });
      expect(screen.getByRole('rowheader', { name: 'En face' })).toBeInTheDocument();
      expect(screen.getByText('144 RUE DE L OLIVIER')).toBeInTheDocument();
      expect(screen.getByText(/parcelle 132058200E0318/)).toBeInTheDocument();

      await u.click(screen.getByRole('button', { name: "Utiliser ce repère pour l'estimation" }));
      expect(await screen.findByText(PHRASES_ADRESSE.repereUtilise)).toBeInTheDocument();
      const enregistre = lireProjets(window.localStorage)[0];
      expect(enregistre?.projet.marche.dvf).toEqual({
        medianM2: 3600,
        q1M2: 3440,
        q3M2: 3750,
        nombreVentes: 6,
        rayonMetres: 90,
      });
      expect(enregistre?.projet.provenance['marche.dvf.rayonMetres']).toBe('dvf');
      expect(enregistre?.adresse?.numero).toBe(144);
    },
  );

  it(
    'réanalyse l’adresse mémorisée à l’ouverture : sans repère et sans cadastre',
    { timeout: 30_000 },
    async () => {
      const id = await ouvrir({
        ...clientHorsLigne,
        geocoder: () => ok(LIEU),
        analyserAdresse: () => ok(ANALYSE),
      });
      const u = userEvent.setup();
      await u.type(screen.getByLabelText('Adresse du bien'), '144 rue de l’Olivier');
      await u.click(screen.getByRole('button', { name: 'Analyser' }));
      await screen.findByText(
        /Même côté de la rue : 6 ventes comparables/,
        {},
        { timeout: 10_000 },
      );

      render(
        <AppEnMemoire
          chemin={`/projets/${id}/adresse`}
          client={{
            ...clientHorsLigne,
            analyserAdresse: () =>
              ok({
                ...ANALYSE,
                reference: null,
                cadastre: 'indisponible',
                ventesProches: [],
                parcelle: null,
              }),
          }}
        />,
      );
      expect(
        await screen.findByText(PHRASES_ADRESSE.sansRepere, {}, { timeout: 10_000 }),
      ).toBeInTheDocument();
      expect(screen.getByText(PHRASES_ADRESSE.cadastreIndisponible)).toBeInTheDocument();
      expect(screen.getAllByLabelText('Adresse du bien').at(-1)).toHaveValue(LIEU.libelle);
    },
  );

  it(
    'explique chaque échec : réseau, adresse introuvable ou imprécise, analyse indisponible, commune sans ventes',
    { timeout: 30_000 },
    async () => {
      const lieux: Resultat<ResultatGeocodage | null>[] = [
        { ok: false, code: 'RESEAU' },
        { ok: true, valeur: null },
        { ok: true, valeur: { ...LIEU, precision: 'rue', cleBan: '13205_6659' } },
        { ok: true, valeur: { ...LIEU, codeInsee: null } },
        { ok: true, valeur: LIEU },
        { ok: true, valeur: { ...LIEU, cleBan: undefined } },
      ];
      const analyses: Resultat<ReponseAdresse>[] = [
        { ok: false, code: 'RESEAU' },
        { ok: true, valeur: { ...ANALYSE, ventesCommune: 0, reference: null, ventesProches: [] } },
      ];
      await ouvrir({
        ...clientHorsLigne,
        geocoder: () => Promise.resolve(lieux.shift() ?? { ok: false, code: 'FIN' }),
        analyserAdresse: () =>
          analyses.length === 0 ? echec() : Promise.resolve(analyses.shift()!),
      });
      const u = userEvent.setup();
      await u.type(screen.getByLabelText('Adresse du bien'), 'Marseille');
      const attendus = [
        PHRASES_ADRESSE.indisponible,
        PHRASES_ADRESSE.introuvable,
        'Adresse trouvée à la rue seulement : ajoutez le numéro.',
        PHRASES_ADRESSE.introuvable,
        PHRASES_ADRESSE.indisponible,
        PHRASES_ADRESSE.sansVentes,
      ];
      for (const message of attendus) {
        await u.click(screen.getByRole('button', { name: 'Analyser' }));
        expect(await screen.findByText(message, {}, { timeout: 10_000 })).toBeInTheDocument();
      }
      expect(lireProjets(window.localStorage)[0]?.adresse).toMatchObject({
        codeVoie: null,
        numero: null,
      });
    },
  );
});
