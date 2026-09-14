import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { construireProjet, type SaisieProjet } from '@/annonces';
import { AppEnMemoire } from '@/App';
import { ClientWorkerProvider } from '@/coque/ClientWorker';
import { FormulaireProjet, valeursDepuisChamps } from '@/ecrans/FormulaireProjet';
import { PHRASES_ESTIMER_LOYER } from '@/ecrans/formulaire/EstimerLoyer';
import {
  clientHorsLigne,
  type ClientWorker,
  type DpeAdresse,
  type ReponseAdresse,
  type ReponseMarche,
  type ReponseRisques,
  type Resultat,
  type ResultatGeocodage,
} from '@/enrichissement';
import { lireProjets } from '@/stockage/projets';
import { PHRASES_DONNEES_ADRESSE } from '@/textes/donnees-adresse';

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

const ANALYSE: ReponseAdresse = {
  codeInsee: '13205',
  millesime: '2025',
  parcelle: null,
  parcellesVoisines: [],
  cadastre: 'ok',
  ventesCommune: 10,
  groupes: [
    { code: 'rayon_100', ventes: 6, comparables: 6, statistiques: STATS, distanceMaxMetres: 90 },
  ],
  reference: { code: 'rayon_100', rayonMetres: 90, statistiques: STATS },
  ventesProches: [],
  tendance: null,
  communesVoisines: [{ codeInsee: '13204', ventes: 2 }],
  sources: [{ nom: 'DVF', url: 'https://www.data.gouv.fr', licence: 'Licence Ouverte 2.0' }],
};

const dpe = (o: Partial<DpeAdresse>): DpeAdresse => ({
  numero: 'X',
  date: '2024-01-01',
  finValidite: '2034-01-01',
  etiquetteDpe: 'D',
  etiquetteGes: 'D',
  typeBatiment: 'appartement',
  surface: 65,
  etage: 3,
  complement: null,
  cleBan: '13205_6659_00144',
  anneeConstruction: null,
  distanceMetres: 0,
  ...o,
});

/** Le T3 d'exemple fait 65 m² au 3e : le DPE « 3e étage » de 72,5 m² lui ressemble le plus. */
const DPE: DpeAdresse[] = [
  dpe({
    numero: 'RDC',
    etiquetteDpe: 'C',
    etiquetteGes: 'C',
    surface: 64.1,
    etage: 0,
    complement: 'Rdc',
  }),
  dpe({
    numero: 'TROISIEME',
    etiquetteDpe: 'E',
    etiquetteGes: 'D',
    surface: 72.5,
    etage: 3,
    complement: '3e étage',
  }),
];

const RISQUES: ReponseRisques = {
  url: 'https://www.georisques.gouv.fr/rapport',
  risques: [
    {
      code: 'retraitGonflementArgile',
      famille: 'naturel',
      libelle: 'Retrait gonflement des argiles',
      adresse: 'fort',
      commune: 'fort',
    },
    {
      code: 'inondation',
      famille: 'naturel',
      libelle: 'Inondation',
      adresse: 'inconnu',
      commune: 'moyen',
    },
  ],
};

const MARCHE: ReponseMarche = {
  codeInsee: '13205',
  commune: 'Marseille 5e Arrondissement',
  dvf: null,
  loyer: { loyerM2: 15, basM2: 12, hautM2: 19, observations: 100 },
  zone: 'A',
  sources: [
    {
      nom: 'Carte des loyers',
      url: 'https://www.data.gouv.fr',
      licence: 'libre',
      mention: 'Estimations ANIL, à partir des données du Groupe SeLoger et de leboncoin',
    },
  ],
};

async function ouvrir(client: ClientWorker): Promise<string> {
  render(<AppEnMemoire chemin="/projets" />);
  await screen.findByRole('heading', { name: 'Mes projets' });
  const id = lireProjets(window.localStorage)[0]?.id ?? '';
  render(<AppEnMemoire chemin={`/projets/${id}/adresse`} client={client} />);
  await screen.findByRole('heading', { name: /l'adresse exacte/ });
  const u = userEvent.setup();
  await u.type(screen.getByLabelText('Adresse du bien'), '144 rue de l’Olivier');
  await u.click(screen.getByRole('button', { name: 'Analyser' }));
  return id;
}

const enregistre = (id: string): ReturnType<typeof lireProjets>[number] | undefined =>
  lireProjets(window.localStorage).find((p) => p.id === id);

describe('Onglet Estimation : DPE, loyer, risques', () => {
  it(
    'propose le DPE du logement, applique risques et loyer de référence, puis DPE et loyer visé sur clic',
    { timeout: 30_000 },
    async () => {
      const marches: unknown[] = [];
      const id = await ouvrir({
        ...clientHorsLigne,
        geocoder: () => ok(LIEU),
        analyserAdresse: () => ok(ANALYSE),
        dpe: () => ok(DPE),
        risques: () => ok(RISQUES),
        marche: (p) => {
          marches.push(p);
          return ok(MARCHE);
        },
      });
      expect(
        await screen.findByRole('heading', { name: 'Le DPE du logement' }, { timeout: 10_000 }),
      ).toBeInTheDocument();
      expect(marches).toEqual([
        { codeInsee: '13205', codePostal: '13005', type: 'appartement', pieces: 3 },
      ]);

      // Appliqués d'eux-mêmes : risques de l'adresse et loyer de référence.
      const apresAnalyse = enregistre(id);
      expect(apresAnalyse?.projet.marche.risques).toEqual([
        { type: 'retraitGonflementArgile', niveau: 'fort' },
      ]);
      expect(apresAnalyse?.projet.provenance['marche.risques']).toBe('georisques');
      expect(apresAnalyse?.projet.marche.loyerReferenceM2).toBe(13.8);
      expect(apresAnalyse?.adresse?.codePostal).toBe('13005');
      expect(screen.getByText('Retrait gonflement des argiles · fort')).toBeInTheDocument();
      expect(screen.getByText('Inondation · moyen')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Voir le rapport officiel' })).toHaveAttribute(
        'href',
        RISQUES.url,
      );
      expect(screen.getByText(/communes voisines comprises \(13204\)/)).toBeInTheDocument();

      // DPE : le « 3e étage » est proposé en premier, appliqué sur clic.
      expect(screen.getByText('le plus proche de votre bien')).toBeInTheDocument();
      const u = userEvent.setup();
      await u.click(screen.getByTitle('Utiliser le DPE TROISIEME'));
      expect(await screen.findByText(PHRASES_DONNEES_ADRESSE.dpeApplique)).toBeInTheDocument();
      expect(enregistre(id)?.projet.bien).toMatchObject({ dpe: 'E', ges: 'D' });
      expect(enregistre(id)?.projet.provenance['bien.dpe']).toBe('ademe');

      // Loyer : 15 €/m² ANIL → 897 € nu, 1 032 € meublé ; le projet est en meublé.
      expect(n(screen.getByText(/par mois hors charges en location nue/).textContent)).toBe(
        '897 € par mois hors charges en location nue, 1 032 € en meublé ; fourchette des annonces : 718 € à 1 136 €.',
      );
      await u.click(screen.getByRole('button', { name: /comme loyer visé/ }));
      expect(await screen.findByText(PHRASES_DONNEES_ADRESSE.loyerApplique)).toBeInTheDocument();
      expect(enregistre(id)?.projet.hypotheses.location).toMatchObject({ loyerHc: 1032 });
      expect(enregistre(id)?.projet.provenance['location.loyerHc']).toBe('anil');
    },
  );

  it(
    'services en panne ou sans données : chaque carte le dit, le projet ne bouge pas',
    { timeout: 30_000 },
    async () => {
      const id = await ouvrir({
        ...clientHorsLigne,
        geocoder: () => ok({ ...LIEU, codePostal: null }),
        analyserAdresse: () => ok({ ...ANALYSE, communesVoisines: undefined }),
        dpe: () => echec(),
        risques: () => echec(),
      });
      expect(
        await screen.findByText(PHRASES_DONNEES_ADRESSE.dpeIndisponible, {}, { timeout: 10_000 }),
      ).toBeInTheDocument();
      expect(screen.getByText(PHRASES_DONNEES_ADRESSE.risquesIndisponibles)).toBeInTheDocument();
      expect(screen.getByText(PHRASES_DONNEES_ADRESSE.loyerIndisponible)).toBeInTheDocument();
      expect(enregistre(id)?.projet.marche.risques).toEqual([{ type: 'argiles', niveau: 'moyen' }]);
      expect(enregistre(id)?.adresse?.codePostal).toBeUndefined();
    },
  );

  it('aucun DPE ressemblant, aucun risque, pas de loyer publié', { timeout: 30_000 }, async () => {
    await ouvrir({
      ...clientHorsLigne,
      geocoder: () => ok(LIEU),
      analyserAdresse: () => ok(ANALYSE),
      dpe: () =>
        ok([
          dpe({
            numero: 'LOIN',
            surface: 200,
            etage: 7,
            cleBan: '13205_6659_00150',
            finValidite: '2020-01-01',
            typeBatiment: 'immeuble',
          }),
        ]),
      risques: () => ok({ url: null, risques: [] }),
      marche: () => ok({ ...MARCHE, loyer: null }),
    });
    expect(
      await screen.findByText(PHRASES_DONNEES_ADRESSE.dpeChoisir, {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('expiré')).toBeInTheDocument();
    expect(screen.getByText(PHRASES_DONNEES_ADRESSE.risquesAucun)).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Voir le rapport officiel' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(PHRASES_DONNEES_ADRESSE.loyerIndisponible)).toBeInTheDocument();
  });

  it('aucun DPE enregistré à l’adresse', { timeout: 30_000 }, async () => {
    await ouvrir({
      ...clientHorsLigne,
      geocoder: () => ok(LIEU),
      analyserAdresse: () => ok(ANALYSE),
      dpe: () => ok([]),
    });
    expect(
      await screen.findByText(PHRASES_DONNEES_ADRESSE.dpeAucun, {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
  });
});

describe('Formulaire Vérifier : estimer le loyer', () => {
  function formulaire(
    client: ClientWorker,
    champs: Parameters<typeof valeursDepuisChamps>[0],
    onCreer = vi.fn<(s: SaisieProjet) => void>(),
  ): { container: HTMLElement; onCreer: typeof onCreer } {
    const { container } = render(
      <ClientWorkerProvider client={client}>
        <FormulaireProjet initial={valeursDepuisChamps(champs)} annonce={null} onCreer={onCreer} />
      </ClientWorkerProvider>,
    );
    return { container, onCreer };
  }
  const champ = (container: HTMLElement, nom: string): HTMLInputElement => {
    const el = container.querySelector<HTMLInputElement>(`[name="${nom}"]`);
    if (el === null) throw new Error(`champ ${nom} absent`);
    return el;
  };

  it('propose le loyer ANIL du mode choisi, marqué comme estimé jusqu’au projet', async () => {
    const demandes: unknown[] = [];
    const { container, onCreer } = formulaire(
      {
        ...clientHorsLigne,
        geocoder: (q, cp) => {
          demandes.push([q, cp]);
          return ok({ ...LIEU, codeInsee: '13055' });
        },
        marche: (p) => {
          demandes.push(p);
          return ok(MARCHE);
        },
      },
      {
        typeBien: 'maison',
        prix: 155_000,
        surface: 65,
        pieces: 3,
        codePostal: '13005',
        ville: 'Marseille',
      },
    );
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Estimer le loyer' }));
    expect(await screen.findByText(/Loyer de marché \(ANIL\)/)).toBeInTheDocument();
    expect(champ(container, 'loyerHc').value).toBe('1032');
    expect(demandes).toEqual([
      ['13005 Marseille', '13005'],
      { codeInsee: '13055', codePostal: '13005', type: 'maison', pieces: 3 },
    ]);

    await u.type(champ(container, 'apport'), '10000');
    await u.type(champ(container, 'revenusMensuels'), '3000');
    await u.click(screen.getByRole('button', { name: /Créer le projet/ }));
    const saisie = onCreer.mock.calls[0]?.[0];
    expect(saisie?.provenance.loyerHc).toBe('estime');
    expect(construireProjet(saisie!, 'p').provenance?.['location.loyerHc']).toBe('anil');
  });

  it('champs manquants, ville introuvable, Worker en panne, loyer non publié', async () => {
    const incomplet = formulaire(clientHorsLigne, {});
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Estimer le loyer' }));
    expect(screen.getByText(PHRASES_ESTIMER_LOYER.incomplet)).toBeInTheDocument();
    incomplet.container.remove();

    const complets = { surface: 65, codePostal: '13005', ville: 'Marseille' };
    const cas: [ClientWorker, string][] = [
      [{ ...clientHorsLigne, geocoder: () => ok(null) }, PHRASES_ESTIMER_LOYER.indisponible],
      [{ ...clientHorsLigne, geocoder: () => echec() }, PHRASES_ESTIMER_LOYER.indisponible],
      [{ ...clientHorsLigne, geocoder: () => ok(LIEU) }, PHRASES_ESTIMER_LOYER.indisponible],
      [
        {
          ...clientHorsLigne,
          geocoder: () => ok(LIEU),
          marche: () => ok({ ...MARCHE, loyer: null }),
        },
        PHRASES_DONNEES_ADRESSE.loyerIndisponible,
      ],
    ];
    for (const [client, message] of cas) {
      const { container } = formulaire(client, complets);
      await u.click(screen.getByRole('button', { name: 'Estimer le loyer' }));
      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(champ(container, 'loyerHc').value).toBe('');
      container.remove();
    }
  });
});
