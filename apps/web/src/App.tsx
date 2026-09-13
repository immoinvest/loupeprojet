import type { JSX } from 'react';
import { BrowserRouter, MemoryRouter, Navigate, useRoutes, type RouteObject } from 'react-router';

import { clientHorsLigne, clientWorker, urlWorker, type ClientWorker } from '@/enrichissement';

import { AppLayout } from './coque/AppLayout';
import { ClientWorkerProvider } from './coque/ClientWorker';
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

/** Le Worker de production, ou celui désigné par `VITE_WORKER_URL` au build. */
const CLIENT_WORKER = clientWorker(urlWorker(import.meta.env.VITE_WORKER_URL), (url, init) =>
  fetch(url, init),
);

export function App(): JSX.Element {
  return (
    <ProjetsProvider>
      <ClientWorkerProvider client={CLIENT_WORKER}>
        <BrowserRouter>
          <Racine />
        </BrowserRouter>
      </ClientWorkerProvider>
    </ProjetsProvider>
  );
}

/** Pour les tests : même arbre de routes, en mémoire, hors ligne sauf client fourni. */
export function AppEnMemoire({
  chemin = '/',
  stockage,
  client = clientHorsLigne,
}: {
  chemin?: string;
  stockage?: Storage;
  client?: ClientWorker;
}): JSX.Element {
  return (
    <ProjetsProvider stockage={stockage}>
      <ClientWorkerProvider client={client}>
        <MemoryRouter initialEntries={[chemin]}>
          <Racine />
        </MemoryRouter>
      </ClientWorkerProvider>
    </ProjetsProvider>
  );
}
