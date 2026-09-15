import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import {
  clientHorsLigne,
  type ClientWorker,
  type ReponseAdresse,
  type Resultat,
  type VenteProcheAdresse,
} from '@/enrichissement';
import { ecrireProjets, lireProjets } from '@/stockage/projets';
import { PHRASES_VENTES } from '@/textes/ventes';

const n = (s: string | null): string => (s ?? '').replace(/\s/g, ' ');
const ok = <T,>(valeur: T): Promise<Resultat<T>> => Promise.resolve({ ok: true, valeur });

const ADRESSE = {
  libelle: "144 Rue de l'Olivier 13005 Marseille",
  lat: 43.294813,
  lon: 5.393807,
  codeInsee: '13205',
  codeVoie: '6659',
  numero: 144,
  codePostal: '13005',
};

const DPE_BASE = {
  etiquetteGes: 'E',
  consommationM2: 380,
  periodeConstruction: 'avant 1948',
  energieChauffage: 'Électricité',
  date: '2024-06-01',
  surface: 50,
} as const;

/** Une vente telle qu'un Worker d'avant le contrat v7 la renvoie. */
function venteV6(i: number): VenteProcheAdresse {
  return {
    date: `2025-${String((i % 12) + 1).padStart(2, '0')}-15`,
    prix: (3000 + 20 * i) * 50,
    surface: 50,
    prixM2: 3000 + 20 * i,
    pieces: (i % 4) + 1,
    type: 'appartement',
    adresse: `${String(i + 1)} RUE TEST`,
    distanceMetres: 10 * i,
    groupes: i < 3 ? ['meme_parcelle', 'rayon_100'] : ['rayon_100'],
  };
}

/**
 * 45 ventes : la i-ème à 10 × i mètres, 3 000 + 20 × i €/m² ; DPE F pour i multiple de 5, G pour i ≡ 1 (mod 5),
 * inconnu sinon (18 passoires) ; les trois premières dans le même immeuble.
 */
const VENTES: VenteProcheAdresse[] = Array.from({ length: 45 }, (_, i) => ({
  ...venteV6(i),
  carrez: 48.5,
  parcelle: '132058200E0318',
  dependances: 1,
  terrain: null,
  lots: 2,
  dpe:
    i % 5 === 0
      ? { ...DPE_BASE, etiquetteDpe: 'F' }
      : i % 5 === 1
        ? { ...DPE_BASE, etiquetteDpe: 'G' }
        : null,
}));

const STATS = { ventes: 8, medianeM2: 3400, q1M2: 3200, q3M2: 3600, minM2: 2950, maxM2: 3880 };

/** Réponse d'un Worker d'avant le contrat v7 : cinq ventes, sans DPE ni plafond. */
const ANALYSE_V6: ReponseAdresse = {
  codeInsee: '13205',
  millesime: '2025',
  parcelle: '132058200E0318',
  parcellesVoisines: [],
  cadastre: 'ok',
  ventesCommune: 1400,
  groupes: [
    { code: 'meme_parcelle', ventes: 3, comparables: 3, statistiques: null, distanceMaxMetres: 20 },
    { code: 'rayon_100', ventes: 45, comparables: 45, statistiques: STATS, distanceMaxMetres: 99 },
  ],
  reference: null,
  ventesProches: [0, 1, 2, 3, 4].map(venteV6),
  sources: [],
};

const ANALYSE: ReponseAdresse = {
  ...ANALYSE_V6,
  ventesProches: VENTES,
  ventesProchesTotal: 1240,
  ventesProchesTronquees: true,
  dpeVentes: 'ok',
};

async function ouvrir(analyse: ReponseAdresse): Promise<HTMLElement> {
  render(<AppEnMemoire chemin="/projets" />);
  await screen.findByRole('heading', { name: 'Mes projets' });
  const [premier, ...autres] = lireProjets(window.localStorage);
  if (premier === undefined) throw new Error('aucun projet');
  ecrireProjets(window.localStorage, [{ ...premier, adresse: ADRESSE }, ...autres]);
  const client: ClientWorker = { ...clientHorsLigne, analyserAdresse: () => ok(analyse) };
  render(<AppEnMemoire chemin={`/projets/${premier.id}/adresse`} client={client} />);
  const titre = await screen.findByRole(
    'heading',
    { name: PHRASES_VENTES.titre },
    { timeout: 10_000 },
  );
  const carte = titre.closest('section');
  if (carte === null) throw new Error('carte des ventes introuvable');
  return carte;
}

/** Texte de la colonne Adresse des lignes de ventes affichées (sans les lignes de détail). */
function adresses(carte: HTMLElement): string[] {
  return within(carte)
    .getAllByRole('row')
    .slice(1)
    .flatMap((ligne) => {
      const cellules = within(ligne).queryAllByRole('cell');
      return cellules.length > 2 ? [cellules[1]?.textContent ?? ''] : [];
    });
}

describe('Tableau des ventes comparables', () => {
  it(
    'pages de 20, tri par colonne, filtres cumulés, détail dépliable',
    { timeout: 30_000 },
    async () => {
      const carte = await ouvrir(ANALYSE);
      const u = userEvent.setup();
      expect(n(within(carte).getByText(/ventes les plus proches sur/).textContent)).toBe(
        'Les 45 ventes les plus proches sur 1 240.',
      );
      expect(adresses(carte)).toHaveLength(20);
      expect(adresses(carte)[0]).toBe('1 RUE TEST');
      expect(within(carte).getByRole('columnheader', { name: /^Distance/ })).toHaveAttribute(
        'aria-sort',
        'ascending',
      );
      expect(within(carte).getByRole('columnheader', { name: 'DPE' })).toHaveAttribute(
        'aria-sort',
        'none',
      );

      // Pages.
      expect(within(carte).getByText('Page 1 sur 3')).toBeInTheDocument();
      expect(within(carte).getByRole('button', { name: 'Précédent' })).toBeDisabled();
      await u.click(within(carte).getByRole('button', { name: 'Suivant' }));
      expect(within(carte).getByText('Page 2 sur 3')).toBeInTheDocument();
      expect(adresses(carte)[0]).toBe('21 RUE TEST');

      // Tri : croissant puis décroissant, retour en page 1.
      await u.click(within(carte).getByRole('button', { name: 'Prix au m²' }));
      expect(within(carte).getByRole('columnheader', { name: /^Prix au m²/ })).toHaveAttribute(
        'aria-sort',
        'ascending',
      );
      expect(within(carte).getByText('Page 1 sur 3')).toBeInTheDocument();
      await u.click(within(carte).getByRole('button', { name: /^Prix au m²/ }));
      expect(within(carte).getByRole('columnheader', { name: /^Prix au m²/ })).toHaveAttribute(
        'aria-sort',
        'descending',
      );
      expect(adresses(carte)[0]).toBe('45 RUE TEST');
      expect(within(carte).getByRole('columnheader', { name: 'Distance' })).toHaveAttribute(
        'aria-sort',
        'none',
      );

      // Filtres.
      const filtres = within(carte).getByRole('group', { name: PHRASES_VENTES.filtres });
      await u.click(within(filtres).getByRole('button', { name: 'DPE F ou G' }));
      expect(within(filtres).getByRole('button', { name: 'DPE F ou G' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(n(within(filtres).getByText(/ventes ·/).textContent)).toContain('18 ventes');
      expect(within(carte).queryByRole('navigation')).not.toBeInTheDocument();
      await u.click(within(filtres).getByRole('button', { name: 'Même immeuble' }));
      // Même immeuble (i < 3) et passoire (i ≡ 0 ou 1 mod 5) : i = 0 et 1.
      expect([...adresses(carte)].sort()).toEqual(['1 RUE TEST', '2 RUE TEST']);
      await u.click(within(filtres).getByRole('button', { name: '3 pièces' }));
      expect(within(carte).getByText(PHRASES_VENTES.aucune)).toBeInTheDocument();
      await u.click(within(filtres).getByRole('button', { name: '3 pièces' }));

      // Détail.
      const [detail] = within(carte).getAllByRole('button', { name: /^Détail/ });
      if (detail === undefined) throw new Error('aucun bouton Détail');
      expect(detail).toHaveAttribute('aria-expanded', 'false');
      await u.click(detail);
      expect(detail).toHaveAttribute('aria-expanded', 'true');
      expect(within(carte).getByText(PHRASES_VENTES.dpeProbable)).toBeInTheDocument();
      expect(n(within(carte).getByText(/dépendance vendue avec/).textContent)).toBe(
        '1 dépendance vendue avec (cave, parking…) · 2 lots de copropriété',
      );
      expect(within(carte).getByText(/Parcelle cadastrale 132058200E0318/)).toBeInTheDocument();
      await u.click(detail);
      expect(within(carte).queryByText(PHRASES_VENTES.dpeProbable)).not.toBeInTheDocument();
    },
  );

  it(
    'colonnes Min et Max ; réponse d’un Worker d’avant le contrat v7 : ni DPE, ni pages, ni phrase tronquée',
    { timeout: 30_000 },
    async () => {
      const carte = await ouvrir(ANALYSE_V6);
      expect(within(carte).queryByRole('columnheader', { name: 'DPE' })).not.toBeInTheDocument();
      expect(within(carte).queryByText(/ventes les plus proches sur/)).not.toBeInTheDocument();
      expect(within(carte).queryByRole('navigation')).not.toBeInTheDocument();
      expect(within(carte).queryByRole('button', { name: 'DPE F ou G' })).not.toBeInTheDocument();
      expect(adresses(carte)).toHaveLength(5);

      const titre = screen.getByRole('heading', { name: 'Les ventes, du plus près au plus large' });
      const tableau = titre.closest('section');
      if (tableau === null) throw new Error('tableau des groupes introuvable');
      expect(within(tableau).getByRole('columnheader', { name: 'Min' })).toBeInTheDocument();
      expect(within(tableau).getByRole('columnheader', { name: 'Max' })).toBeInTheDocument();
      const rayon = within(tableau).getByRole('row', { name: /À moins de 100 m/ });
      expect(n(rayon.textContent)).toContain('2 950 €/m²');
      expect(n(rayon.textContent)).toContain('3 880 €/m²');
      const immeuble = within(tableau).getByRole('row', { name: /Même immeuble/ });
      expect(within(immeuble).getAllByText('—')).toHaveLength(4);
    },
  );
});
