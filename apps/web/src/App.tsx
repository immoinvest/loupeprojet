import type { JSX } from 'react';
import { BrowserRouter, MemoryRouter, Navigate, useRoutes, type RouteObject } from 'react-router';

import { AppLayout } from './coque/AppLayout';
import { ProjetLayout } from './coque/ProjetLayout';
import { Bientot } from './ecrans/Bientot';
import { MesProjets } from './ecrans/MesProjets';
import { NouveauProjet } from './ecrans/NouveauProjet';
import { Rapport } from './ecrans/Rapport';
import { ProjetsProvider } from './stockage/ProjetsContext';

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/projets" replace /> },
      { path: 'projets', element: <MesProjets /> },
      { path: 'projets/nouveau', element: <NouveauProjet /> },
      {
        path: 'projets/:id',
        element: <ProjetLayout />,
        children: [
          { index: true, element: <Rapport /> },
          {
            path: 'hypotheses',
            element: (
              <Bientot
                titre="Hypothèses"
                phrase="Bientôt : modifiez chaque hypothèse ici, le rapport se recalcule instantanément."
              />
            ),
          },
          {
            path: 'fiscalite',
            element: (
              <Bientot
                titre="Fiscalité"
                phrase="Bientôt : les quatre régimes année par année, et l'année où vous commencez à payer."
              />
            ),
          },
          {
            path: 'revente',
            element: (
              <Bientot
                titre="Revente"
                phrase="Bientôt : la revente à 5, 10 et 15 ans, plus-value et impôt détaillés."
              />
            ),
          },
          {
            path: 'visite',
            element: (
              <Bientot
                titre="Préparer la visite"
                phrase="Bientôt : la liste des points à vérifier sur place, générée à partir de ce projet."
              />
            ),
          },
        ],
      },
      {
        path: 'comparer',
        element: <Bientot titre="Comparer" phrase="Bientôt : deux à cinq projets côte à côte." />,
      },
      {
        path: 'methode',
        element: (
          <Bientot
            titre="Comment c'est calculé"
            phrase="Bientôt : chaque formule, chaque source, chaque hypothèse par défaut."
          />
        ),
      },
      {
        path: 'extension',
        element: (
          <Bientot
            titre="Extension navigateur"
            phrase="Bientôt : lisez une annonce LeBonCoin, SeLoger ou Bien'ici en un clic."
          />
        ),
      },
      {
        path: '*',
        element: (
          <Bientot
            titre="Page introuvable"
            phrase="Cette adresse ne correspond à rien dans Loupe."
          />
        ),
      },
    ],
  },
];

function Racine(): JSX.Element | null {
  return useRoutes(routes);
}

export function App(): JSX.Element {
  return (
    <ProjetsProvider>
      <BrowserRouter>
        <Racine />
      </BrowserRouter>
    </ProjetsProvider>
  );
}

/** Pour les tests : même arbre de routes, en mémoire. */
export function AppEnMemoire({
  chemin = '/',
  stockage,
}: {
  chemin?: string;
  stockage?: Storage;
}): JSX.Element {
  return (
    <ProjetsProvider stockage={stockage}>
      <MemoryRouter initialEntries={[chemin]}>
        <Racine />
      </MemoryRouter>
    </ProjetsProvider>
  );
}
