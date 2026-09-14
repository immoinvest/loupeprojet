import { useMemo, type JSX } from 'react';
import { BrowserRouter, MemoryRouter, Navigate, useRoutes, type RouteObject } from 'react-router';

import { creerSuiviInstallation, suiviIndisponible, type SuiviInstallation } from '@/application';
import { clientHorsLigne, clientWorker, urlWorker, type ClientWorker } from '@/enrichissement';

import { CompteProvider } from './compte/CompteContext';
import { clientMemoire } from './compte/memoire';
import { clientReseau } from './compte/reseau';
import type { ClientCompte } from './compte/types';
import { AppLayout } from './coque/AppLayout';
import { GestionProvider } from './gestion/GestionContext';
import { clientGestionMemoire } from './gestion/memoire';
import { clientGestionReseau } from './gestion/reseau';
import type { ClientGestion } from './gestion/types';
import { ClientWorkerProvider } from './coque/ClientWorker';
import { InstallationProvider } from './coque/Installation';
import { ProjetLayout } from './coque/ProjetLayout';
import { Bientot } from './ecrans/Bientot';
import { Comparer } from './ecrans/Comparer';
import { Compte } from './ecrans/Compte';
import { Connexion } from './ecrans/Connexion';
import { Extension } from './ecrans/Extension';
import { Financement } from './ecrans/Financement';
import { Fiscalite } from './ecrans/Fiscalite';
import { AjouterMain } from './ecrans/gerer/AjouterMain';
import { Gerer } from './ecrans/gerer/Gerer';
import { PretAGerer } from './ecrans/gerer/PretAGerer';
import { Hypotheses } from './ecrans/Hypotheses';
import { Imprimer } from './ecrans/Imprimer';
import { MesProjets } from './ecrans/MesProjets';
import { NouveauProjet } from './ecrans/NouveauProjet';
import { Partage } from './ecrans/Partage';
import { Rapport } from './ecrans/Rapport';
import { Revente } from './ecrans/Revente';
import { SimulateurImprimer } from './ecrans/SimulateurImprimer';
import { SimulateurPret } from './ecrans/SimulateurPret';
import { Visite } from './ecrans/Visite';
import { Adresse } from './ecrans/Adresse';
import { ProjetsProvider } from './stockage/ProjetsContext';

export const routes: RouteObject[] = [
  // Hors de la coque : la page de connexion classique, centrée, et le document imprimable.
  { path: 'connexion', element: <Connexion /> },
  { path: 'projets/:id/imprimer', element: <Imprimer /> },
  { path: 'simulateur-pret/imprimer', element: <SimulateurImprimer /> },
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
          { path: 'financement', element: <Financement /> },
          { path: 'hypotheses', element: <Hypotheses /> },
          { path: 'fiscalite', element: <Fiscalite /> },
          { path: 'revente', element: <Revente /> },
          { path: 'visite', element: <Visite /> },
          { path: 'adresse', element: <Adresse /> },
        ],
      },
      { path: 'gerer', element: <Gerer /> },
      { path: 'gerer/ajouter', element: <AjouterMain /> },
      { path: 'gerer/pret/:id', element: <PretAGerer /> },
      { path: 'compte', element: <Compte /> },
      { path: 'partage', element: <Partage /> },
      { path: 'comparer', element: <Comparer /> },
      { path: 'simulateur-pret', element: <SimulateurPret /> },
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

/** Le client de la gestion locative : l'API /api/gestion du même worker, même origine. */
const CLIENT_GESTION = clientGestionReseau();

/** Invite d'installation et mode application, écoutés dès le chargement, avant le premier rendu. */
const SUIVI_INSTALLATION = creerSuiviInstallation(window);

export function App(): JSX.Element {
  return (
    <ProjetsProvider>
      <ClientWorkerProvider client={CLIENT_WORKER}>
        <CompteProvider client={CLIENT_COMPTE}>
          <GestionProvider client={CLIENT_GESTION}>
            <InstallationProvider suivi={SUIVI_INSTALLATION}>
              <BrowserRouter>
                <Racine />
              </BrowserRouter>
            </InstallationProvider>
          </GestionProvider>
        </CompteProvider>
      </ClientWorkerProvider>
    </ProjetsProvider>
  );
}

/**
 * Pour les tests : même arbre de routes, en mémoire ; Worker hors ligne, compte anonyme en mémoire
 * et rien à installer, sauf clients fournis.
 */
export function AppEnMemoire({
  chemin = '/',
  stockage,
  client = clientHorsLigne,
  compte,
  gestion,
  installation = suiviIndisponible,
}: {
  chemin?: string;
  stockage?: Storage;
  client?: ClientWorker;
  compte?: ClientCompte;
  gestion?: ClientGestion;
  installation?: SuiviInstallation;
}): JSX.Element {
  const clientCompte = useMemo(() => compte ?? clientMemoire(), [compte]);
  const clientGestion = useMemo(() => gestion ?? clientGestionMemoire(), [gestion]);
  return (
    <ProjetsProvider stockage={stockage}>
      <ClientWorkerProvider client={client}>
        <CompteProvider client={clientCompte}>
          <GestionProvider client={clientGestion} stockage={stockage}>
            <InstallationProvider suivi={installation}>
              <MemoryRouter initialEntries={[chemin]}>
                <Racine />
              </MemoryRouter>
            </InstallationProvider>
          </GestionProvider>
        </CompteProvider>
      </ClientWorkerProvider>
    </ProjetsProvider>
  );
}
