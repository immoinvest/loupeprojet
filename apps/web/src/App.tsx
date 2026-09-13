import type { JSX } from 'react';
import { BrowserRouter, MemoryRouter, Navigate, useRoutes, type RouteObject } from 'react-router';

import { AppLayout } from './coque/AppLayout';
import { ProjetLayout } from './coque/ProjetLayout';
import { Bientot } from './ecrans/Bientot';
import { Fiscalite } from './ecrans/Fiscalite';
import { Hypotheses } from './ecrans/Hypotheses';
import { MesProjets } from './ecrans/MesProjets';
import { NouveauProjet } from './ecrans/NouveauProjet';
import { Rapport } from './ecrans/Rapport';
import { Revente } from './ecrans/Revente';
import { Visite } from './ecrans/Visite';
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
          { path: 'hypotheses', element: <Hypotheses /> },
          { path: 'fiscalite', element: <Fiscalite /> },
          { path: 'revente', element: <Revente /> },
          { path: 'visite', element: <Visite /> },
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
            phrase="Cette adresse ne correspond à rien dans Deklic."
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
