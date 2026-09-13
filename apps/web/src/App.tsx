import { useMemo, type JSX } from 'react';
import { BrowserRouter, MemoryRouter, Navigate, useRoutes, type RouteObject } from 'react-router';

import { clientHorsLigne, clientWorker, urlWorker, type ClientWorker } from '@/enrichissement';

import { CompteProvider } from './compte/CompteContext';
import { clientMemoire } from './compte/memoire';
import { clientReseau } from './compte/reseau';
import type { ClientCompte } from './compte/types';
import { AppLayout } from './coque/AppLayout';
import { ClientWorkerProvider } from './coque/ClientWorker';
import { ProjetLayout } from './coque/ProjetLayout';
import { Bientot } from './ecrans/Bientot';
import { Comparer } from './ecrans/Comparer';
import { Compte } from './ecrans/Compte';
import { Connexion } from './ecrans/Connexion';
import { Extension } from './ecrans/Extension';
import { Fiscalite } from './ecrans/Fiscalite';
import { Hypotheses } from './ecrans/Hypotheses';
import { Imprimer } from './ecrans/Imprimer';
import { MesProjets } from './ecrans/MesProjets';
import { Methode } from './ecrans/Methode';
import { NouveauProjet } from './ecrans/NouveauProjet';
import { Partage } from './ecrans/Partage';
import { Rapport } from './ecrans/Rapport';
import { Revente } from './ecrans/Revente';
import { Visite } from './ecrans/Visite';
import { Adresse } from './ecrans/Adresse';
import { ProjetsProvider } from './stockage/ProjetsContext';

export const routes: RouteObject[] = [
  // Hors de la coque : la page de connexion classique, centrée, et le document imprimable.
  { path: 'connexion', element: <Connexion /> },
  { path: 'projets/:id/imprimer', element: <Imprimer /> },
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
          { path: 'adresse', element: <Adresse /> },
        ],
      },
      { path: 'compte', element: <Compte /> },
      { path: 'partage', element: <Partage /> },
      { path: 'comparer', element: <Comparer /> },
      { path: 'methode', element: <Methode /> },
      { path: 'extension', element: <Extension /> },
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

/** Le client des comptes de production : l'API /api/* servie par le worker Pages, même origine. */
const CLIENT_COMPTE = clientReseau();

export function App(): JSX.Element {
  return (
    <ProjetsProvider>
      <ClientWorkerProvider client={CLIENT_WORKER}>
        <CompteProvider client={CLIENT_COMPTE}>
          <BrowserRouter>
            <Racine />
          </BrowserRouter>
        </CompteProvider>
      </ClientWorkerProvider>
    </ProjetsProvider>
  );
}

/**
 * Pour les tests : même arbre de routes, en mémoire ; Worker hors ligne et compte anonyme en mémoire,
 * sauf clients fournis.
 */
export function AppEnMemoire({
  chemin = '/',
  stockage,
  client = clientHorsLigne,
  compte,
}: {
  chemin?: string;
  stockage?: Storage;
  client?: ClientWorker;
  compte?: ClientCompte;
}): JSX.Element {
  const clientCompte = useMemo(() => compte ?? clientMemoire(), [compte]);
  return (
    <ProjetsProvider stockage={stockage}>
      <ClientWorkerProvider client={client}>
        <CompteProvider client={clientCompte}>
          <MemoryRouter initialEntries={[chemin]}>
            <Racine />
          </MemoryRouter>
        </CompteProvider>
      </ClientWorkerProvider>
    </ProjetsProvider>
  );
}
