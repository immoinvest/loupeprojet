import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import {
  clientHorsLigne,
  type AdresseDvf,
  type ClientWorker,
  type ParametresAdresse,
  type ReponseAdresse,
  type Resultat,
  type ResultatGeocodage,
  type SuggestionAdresse,
} from '@/enrichissement';
import { lireProjets } from '@/stockage/projets';
import { PHRASES_ADRESSE } from '@/textes/adresse';

/*
 * Onglet Estimation : choisir l'adresse dans les suggestions. Le cas d'Aix-en-Provence reproduit le bogue du
 * 14/09/2026 : « 9001 Cité Valcros » n'existe pas dans la BAN (elle ne rend que la rue), mais ses ventes DVF
 * existent ; la suggestion « adresse du cadastre » lance l'analyse avec le numéro fiscal et le code de voie A285.
 */

const ok = <T,>(valeur: T): Promise<Resultat<T>> => Promise.resolve({ ok: true, valeur });

const OLIVIER: SuggestionAdresse = {
  libelle: "144 Rue de l'Olivier 13005 Marseille",
  precision: 'adresse',
  numero: '144',
  rue: "Rue de l'Olivier",
  codePostal: '13005',
  commune: 'Marseille',
  codeInsee: '13205',
  lat: 43.294813,
  lon: 5.393807,
  cleBan: '13205_6659_00144',
};
const RUE_OLIVIER: SuggestionAdresse = {
  ...OLIVIER,
  libelle: "Rue de l'Olivier 13005 Marseille",
  precision: 'rue',
  numero: null,
  lat: 43.2951,
  lon: 5.3941,
  cleBan: '13205_6659',
};
const RUE_VALCROS: SuggestionAdresse = {
  libelle: 'Route de Valcros 13090 Aix-en-Provence',
  precision: 'rue',
  numero: null,
  rue: 'Route de Valcros',
  codePostal: '13090',
  commune: 'Aix-en-Provence',
  codeInsee: '13001',
  lat: 43.5262,
  lon: 5.4318,
  cleBan: '13001_2640',
};
const VALCROS: AdresseDvf = {
  libelle: '9001 CITE VALCROS',
  numero: 9001,
  suffixe: null,
  codeVoie: 'A285',
  voie: 'CITE VALCROS',
  parcelles: ['13001000CP0007'],
  lat: 43.526878,
  lon: 5.430097,
  ventes: 3,
};
const LIEU_144: ResultatGeocodage = {
  libelle: "144 Rue de l'Olivier 13005 Marseille",
  lat: 43.294813,
  lon: 5.393807,
  precision: 'adresse',
  cleBan: '13205_6659_00144',
  codeInsee: '13205',
  codePostal: '13005',
};
const ANALYSE: ReponseAdresse = {
  codeInsee: '13001',
  millesime: '2025',
  parcelle: null,
  parcellesVoisines: [],
  cadastre: 'ok',
  ventesCommune: 3,
  groupes: [],
  reference: null,
  ventesProches: [],
  sources: [],
};

interface Espion {
  readonly analyses: ParametresAdresse[];
  readonly geocodages: string[];
  readonly cadastre: [string, string][];
}

function client(surcharges: Partial<ClientWorker> = {}): { client: ClientWorker; espion: Espion } {
  const espion: Espion = { analyses: [], geocodages: [], cadastre: [] };
  return {
    espion,
    client: {
      ...clientHorsLigne,
      suggererAdresses: (texte) =>
        ok(texte.toLowerCase().includes('valcros') ? [RUE_VALCROS] : [OLIVIER, RUE_OLIVIER]),
      adressesDvf: (codeInsee, texte) => {
        espion.cadastre.push([codeInsee, texte]);
        return ok([VALCROS]);
      },
      geocoder: (recherche) => {
        espion.geocodages.push(recherche);
        return ok(LIEU_144);
      },
      analyserAdresse: (parametres) => {
        espion.analyses.push(parametres);
        return ok(ANALYSE);
      },
      ...surcharges,
    },
  };
}

async function ouvrir(client: ClientWorker): Promise<void> {
  render(<AppEnMemoire chemin="/projets" />);
  await screen.findByRole('heading', { name: 'Mes projets' });
  const id = lireProjets(window.localStorage)[0]?.id ?? '';
  render(<AppEnMemoire chemin={`/projets/${id}/adresse`} client={client} />);
  await screen.findByRole('heading', { name: /l'adresse exacte/ });
}

const champ = (): HTMLElement => screen.getByRole('combobox', { name: 'Adresse du bien' });
const attendreAnalyse = async (espion: Espion, nombre = 1): Promise<void> => {
  await waitFor(
    () => {
      expect(espion.analyses).toHaveLength(nombre);
    },
    { timeout: 10_000 },
  );
};

describe('Onglet Estimation : suggestions d’adresse', () => {
  it(
    'Aix : l’adresse du cadastre « 9001 Cité Valcros » lance l’analyse de l’immeuble',
    { timeout: 30_000 },
    async () => {
      const { client: c, espion } = client();
      await ouvrir(c);
      const u = userEvent.setup();
      await u.type(champ(), '9001 Cité Valcros Aix-en-Provence');
      const option = await screen.findByRole(
        'option',
        {
          name: /9001 Cite Valcros, 13090 Aix-en-Provence\s*adresse du cadastre, 3 ventes connues/,
        },
        { timeout: 10_000 },
      );
      expect(espion.cadastre).toEqual([['13001', '9001 Cité Valcros Aix-en-Provence']]);
      await u.click(option);
      await attendreAnalyse(espion);
      expect(espion.analyses[0]).toEqual({
        codeInsee: '13001',
        lat: 43.526878,
        lon: 5.430097,
        numero: 9001,
        codeVoie: 'A285',
        type: 'appartement',
        surface: 65,
      });
      expect(espion.geocodages).toEqual([]);
      expect(await screen.findByText(PHRASES_ADRESSE.adresseCadastre)).toBeInTheDocument();
      expect(lireProjets(window.localStorage)[0]?.adresse).toEqual({
        libelle: '9001 Cite Valcros, 13090 Aix-en-Provence',
        lat: 43.526878,
        lon: 5.430097,
        codeInsee: '13001',
        codeVoie: 'A285',
        numero: 9001,
        codePostal: '13090',
      });
      expect(champ()).toHaveValue('9001 Cite Valcros, 13090 Aix-en-Provence');
    },
  );

  it(
    'au clavier : Flèche bas puis Entrée analyse l’adresse sans second géocodage',
    { timeout: 30_000 },
    async () => {
      const { client: c, espion } = client();
      await ouvrir(c);
      const u = userEvent.setup();
      expect(screen.getByText("Suggestions d'abord dans le département 13.")).toBeInTheDocument();
      await u.type(champ(), "144 rue de l'oli");
      await screen.findByRole('option', { name: /144 Rue de l'Olivier/ }, { timeout: 10_000 });
      expect(screen.getByRole('option', { name: /rue, sans numéro/ })).toBeInTheDocument();
      // La BAN connaît le numéro : pas de recherche au cadastre.
      expect(espion.cadastre).toEqual([]);
      await u.keyboard('{ArrowDown}{Enter}');
      await attendreAnalyse(espion);
      expect(espion.analyses[0]).toMatchObject({
        numero: 144,
        codeVoie: '6659',
        codeInsee: '13205',
      });
      expect(espion.geocodages).toEqual([]);
    },
  );

  it(
    'une rue demande le numéro : avec le numéro, sans le numéro, numéro illisible',
    { timeout: 40_000 },
    async () => {
      const { client: c, espion } = client();
      await ouvrir(c);
      const u = userEvent.setup();
      await u.type(champ(), "rue de l'olivier");
      await u.click(
        await screen.findByRole('option', { name: /^Rue de l'Olivier/ }, { timeout: 10_000 }),
      );
      const numero = await screen.findByLabelText("Numéro dans Rue de l'Olivier 13005 Marseille ?");
      await u.type(numero, 'cent');
      await u.click(screen.getByRole('button', { name: 'Analyser avec ce numéro' }));
      expect(screen.getByText(PHRASES_ADRESSE.numeroInvalide)).toBeInTheDocument();
      expect(numero).toHaveAttribute('aria-invalid', 'true');
      await u.clear(numero);
      await u.type(numero, '144');
      await u.click(screen.getByRole('button', { name: 'Analyser avec ce numéro' }));
      await attendreAnalyse(espion);
      expect(espion.geocodages).toEqual(["144 Rue de l'Olivier 13005 Marseille"]);
      expect(espion.analyses[0]).toMatchObject({ numero: 144, codeVoie: '6659' });

      await u.clear(champ());
      await u.type(champ(), "rue de l'olivier");
      await u.click(
        await screen.findByRole('option', { name: /^Rue de l'Olivier/ }, { timeout: 10_000 }),
      );
      await u.click(await screen.findByRole('button', { name: 'Je ne connais pas le numéro' }));
      await attendreAnalyse(espion, 2);
      expect(espion.analyses[1]).toMatchObject({
        numero: null,
        codeVoie: '6659',
        lat: 43.2951,
        lon: 5.3941,
      });
      expect(await screen.findByText(PHRASES_ADRESSE.sansNumero)).toBeInTheDocument();
    },
  );

  it(
    'numéro inconnu de la BAN : point de la rue avec le numéro ; numéro fiscal : message du cadastre',
    { timeout: 40_000 },
    async () => {
      const { client: c, espion } = client({
        geocoder: (recherche) => {
          espion.geocodages.push(recherche);
          return ok({ ...LIEU_144, precision: 'rue', cleBan: '13205_6659' });
        },
      });
      await ouvrir(c);
      const u = userEvent.setup();
      for (const [saisi, attendu] of [
        ['12', null],
        ['9001', PHRASES_ADRESSE.numeroCadastre],
      ] as const) {
        await u.clear(champ());
        await u.type(champ(), "rue de l'olivier");
        await u.click(
          await screen.findByRole('option', { name: /^Rue de l'Olivier/ }, { timeout: 10_000 }),
        );
        await u.type(await screen.findByLabelText(/^Numéro dans/), saisi);
        await u.click(screen.getByRole('button', { name: 'Analyser avec ce numéro' }));
        if (attendu === null) {
          await attendreAnalyse(espion);
          expect(espion.analyses[0]).toMatchObject({ numero: 12, lat: 43.2951, codeVoie: '6659' });
        } else {
          expect(await screen.findByText(attendu, {}, { timeout: 10_000 })).toBeInTheDocument();
        }
      }
      expect(espion.analyses).toHaveLength(1);
    },
  );

  it(
    'bouton Analyser : un numéro fiscal que la BAN ne connaît pas renvoie aux suggestions du cadastre',
    { timeout: 30_000 },
    async () => {
      const { client: c } = client({
        suggererAdresses: () => ok([]),
        geocoder: () =>
          ok({ ...LIEU_144, precision: 'rue', cleBan: '13001_1161', codeInsee: '13001' }),
      });
      await ouvrir(c);
      const u = userEvent.setup();
      await u.type(champ(), '9001 route de Galice 13090 Aix-en-Provence');
      // Aucune suggestion (la BAN ne situe pas la commune) : la phrase le dit.
      expect(
        await screen.findByText(PHRASES_ADRESSE.aucuneSuggestion, {}, { timeout: 10_000 }),
      ).toBeInTheDocument();
      await u.click(screen.getByRole('button', { name: 'Analyser' }));
      expect(
        await screen.findByText(PHRASES_ADRESSE.numeroCadastre, {}, { timeout: 10_000 }),
      ).toBeInTheDocument();
    },
  );

  it(
    'hors ligne : suggestions indisponibles, la saisie libre reste',
    { timeout: 30_000 },
    async () => {
      await ouvrir({ ...clientHorsLigne, geocoder: () => ok(LIEU_144) });
      const u = userEvent.setup();
      await u.type(champ(), "144 rue de l'Olivier");
      expect(
        await screen.findByText(PHRASES_ADRESSE.suggestionsIndisponibles, {}, { timeout: 10_000 }),
      ).toBeInTheDocument();
      expect(champ()).toHaveAttribute('aria-expanded', 'false');
      // Deux caractères : le message disparaît avec la recherche.
      await u.clear(champ());
      await u.type(champ(), '14');
      expect(screen.queryByText(PHRASES_ADRESSE.suggestionsIndisponibles)).not.toBeInTheDocument();
    },
  );
});
