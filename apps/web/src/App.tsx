import { useMemo, type JSX } from 'react';
import { BrowserRouter, MemoryRouter, useRoutes, type RouteObject } from 'react-router';

import { creerSuiviInstallation, suiviIndisponible, type SuiviInstallation } from '@/application';
import { clientHorsLigne, clientWorker, urlWorker, type ClientWorker } from '@/enrichissement';

import { CompteProvider } from './compte/CompteContext';
import { clientMemoire } from './compte/memoire';
import { clientReseau } from './compte/reseau';
import type { ClientCompte } from './compte/types';
import { AppLayout } from './coque/AppLayout';
import { ArgentProvider } from './gestion/argent/ArgentContext';
import { clientArgentMemoire } from './gestion/argent/memoire';
import { clientArgentReseau } from './gestion/argent/reseau';
import type { ClientArgent } from './gestion/argent/types';
import { BailProvider } from './gestion/bail/BailContext';
import { clientBailIndisponible } from './gestion/bail/memoire';
import { clientBailReseau } from './gestion/bail/reseau';
import type { ClientBail } from './gestion/bail/types';
import { FinBailProvider } from './gestion/fin-bail/FinBailContext';
import { clientFinBailIndisponible } from './gestion/fin-bail/memoire';
import { clientFinBailReseau } from './gestion/fin-bail/reseau';
import type { ClientFinBail } from './gestion/fin-bail/types';
import { GestionProvider } from './gestion/GestionContext';
import { EnvoisProvider } from './gestion/envois/EnvoisContext';
import { clientAccordMemoire, clientEnvoisMemoire } from './gestion/envois/memoire';
import { clientAccordReseau, clientEnvoisReseau } from './gestion/envois/reseau';
import type { ClientAccord, ClientEnvois } from './gestion/envois/types';
import { Accord } from './ecrans/accord/Accord';
import { clientGestionMemoire } from './gestion/memoire';
import { clientGestionReseau } from './gestion/reseau';
import type { ClientGestion } from './gestion/types';
import { ClientWorkerProvider } from './coque/ClientWorker';
import { InstallationProvider } from './coque/Installation';
import { ProjetLayout } from './coque/ProjetLayout';
import { Accueil } from './ecrans/Accueil';
import { Bientot } from './ecrans/Bientot';
import { Comparer } from './ecrans/Comparer';
import { Compte } from './ecrans/Compte';
import { Connexion } from './ecrans/Connexion';
import { Extension } from './ecrans/Extension';
import { Financement } from './ecrans/Financement';
import { Fiscalite } from './ecrans/Fiscalite';
import { AjouterMain } from './ecrans/gerer/AjouterMain';
import { Argent } from './ecrans/gerer/argent/Argent';
import { ModifierDepense, NouvelleDepense } from './ecrans/gerer/argent/PagesDepense';
import { ImprimerLettre } from './ecrans/gerer/bail/ImprimerLettre';
import { Declaration } from './ecrans/gerer/declaration/Declaration';
import { RecapitulatifAnnee } from './ecrans/gerer/declaration/RecapitulatifAnnee';
import { ImprimerDecompte } from './ecrans/gerer/fin-bail/ImprimerDecompte';
import { FicheBien } from './ecrans/gerer/FicheBien';
import { FicheLocataire } from './ecrans/gerer/FicheLocataire';
import { Gerer } from './ecrans/gerer/Gerer';
import { ImprimerDocument } from './ecrans/gerer/ImprimerDocument';
import { Loyers } from './ecrans/gerer/Loyers';
import { MesBiens } from './ecrans/gerer/MesBiens';
import { MesLocataires } from './ecrans/gerer/MesLocataires';
import { NouveauLocataire } from './ecrans/gerer/NouveauLocataire';
import { PretAGerer } from './ecrans/gerer/PretAGerer';
import { Hypotheses } from './ecrans/Hypotheses';
import { Imprimer } from './ecrans/Imprimer';
import { MesProjets } from './ecrans/MesProjets';
import { NouveauProjet } from './ecrans/NouveauProjet';
import { Partage, PartageCourt } from './ecrans/Partage';
import { Transfert } from './ecrans/Transfert';
import { ORIGINE_PRODUCTION, TRANSFERT_ACTIF } from './application/origine';
import { Bascule } from './coque/Bascule';
import { Rapport } from './ecrans/Rapport';
import { Revente } from './ecrans/Revente';
import { SimulateurImprimer } from './ecrans/SimulateurImprimer';
import { SimulateurPret } from './ecrans/SimulateurPret';
import { Visite } from './ecrans/Visite';
import { Adresse } from './ecrans/Adresse';
import {
  clientPartageMemoire,
  clientPartageReseau,
  type ClientPartage,
} from './stockage/partage-client';
import { PartageProvider } from './stockage/PartageContext';
import { ProjetsProvider } from './stockage/ProjetsContext';
import { clientProjetsMemoire } from './stockage/synchro/memoire';
import { clientProjetsReseau } from './stockage/synchro/reseau';
import { SynchroProvider } from './stockage/synchro/SynchroContext';
import type { ClientProjets } from './stockage/synchro/types';

export const routes: RouteObject[] = [
  // Hors de la coque : la page de connexion classique, centrée, et les documents imprimables.
  { path: 'connexion', element: <Connexion /> },
  { path: 'projets/:id/imprimer', element: <Imprimer /> },
  { path: 'gerer/documents/:id', element: <ImprimerDocument /> },
  { path: 'accord', element: <Accord /> },
  { path: 'gerer/lettres/:id', element: <ImprimerLettre /> },
  { path: 'gerer/declaration/imprimer', element: <RecapitulatifAnnee /> },
  { path: 'gerer/decomptes/:id', element: <ImprimerDecompte /> },
  { path: 'simulateur-pret/imprimer', element: <SimulateurImprimer /> },
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Accueil /> },
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
      { path: 'gerer/loyers', element: <Loyers /> },
      { path: 'gerer/biens', element: <MesBiens /> },
      { path: 'gerer/locataires', element: <MesLocataires /> },
      { path: 'gerer/locataires/nouveau', element: <NouveauLocataire /> },
      { path: 'gerer/locataires/:id', element: <FicheLocataire /> },
      { path: 'gerer/biens/:id', element: <FicheBien /> },
      { path: 'gerer/pret/:id', element: <PretAGerer /> },
      { path: 'gerer/argent', element: <Argent /> },
      { path: 'gerer/depenses/nouvelle', element: <NouvelleDepense /> },
      { path: 'gerer/depenses/:id', element: <ModifierDepense /> },
      { path: 'gerer/declaration', element: <Declaration /> },
      { path: 'compte', element: <Compte /> },
      { path: 'partage', element: <Partage /> },
      { path: 'p/:id', element: <PartageCourt /> },
      { path: 'transfert', element: <Transfert /> },
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

/** Dépenses et prêts des biens gérés : les routes Argent de la même API (ADR-G25). */
const CLIENT_ARGENT = clientArgentReseau();
/** La vie du bail (DPE, révision, lettres) : l'API /api/gestion/bail du même worker, même origine. */
const CLIENT_BAIL = clientBailReseau();
/** La fin du bail (congé, dépôt, charges, colocataires) : l'API /api/gestion/fin-bail (ADR-G34). */
const CLIENT_FIN_BAIL = clientFinBailReseau();

/** La synchronisation des projets avec le compte : l'API /api/projets du même worker, même origine. */
const CLIENT_PROJETS = clientProjetsReseau();

/** Les liens de partage courts : l'API /api/partage du même worker, même origine (ADR-009). */
const CLIENT_PARTAGE = clientPartageReseau();

/** Les quittances envoyées par e-mail : /api/gestion/envois et la page publique /api/accord. */
const CLIENT_ENVOIS = clientEnvoisReseau();
const CLIENT_ACCORD = clientAccordReseau();

/** Invite d'installation et mode application, écoutés dès le chargement, avant le premier rendu. */
const SUIVI_INSTALLATION = creerSuiviInstallation(window);

export function App(): JSX.Element {
  return (
    <ProjetsProvider>
      <Bascule actif={TRANSFERT_ACTIF} origineCible={ORIGINE_PRODUCTION} />
      <PartageProvider client={CLIENT_PARTAGE}>
        <ClientWorkerProvider client={CLIENT_WORKER}>
          <CompteProvider client={CLIENT_COMPTE}>
            <SynchroProvider client={CLIENT_PROJETS}>
              <GestionProvider client={CLIENT_GESTION}>
                <ArgentProvider client={CLIENT_ARGENT}>
                  <EnvoisProvider client={CLIENT_ENVOIS} accord={CLIENT_ACCORD}>
                    <BailProvider client={CLIENT_BAIL}>
                      <FinBailProvider client={CLIENT_FIN_BAIL}>
                        <InstallationProvider suivi={SUIVI_INSTALLATION}>
                          <BrowserRouter>
                            <Racine />
                          </BrowserRouter>
                        </InstallationProvider>
                      </FinBailProvider>
                    </BailProvider>
                  </EnvoisProvider>
                </ArgentProvider>
              </GestionProvider>
            </SynchroProvider>
          </CompteProvider>
        </ClientWorkerProvider>
      </PartageProvider>
    </ProjetsProvider>
  );
}

/**
 * Pour les tests : même arbre de routes, en mémoire ; Worker hors ligne, compte anonyme en mémoire,
 * compte des projets en mémoire (envoi sans délai) et rien à installer, sauf clients fournis.
 */
export function AppEnMemoire({
  chemin = '/',
  stockage,
  client = clientHorsLigne,
  compte,
  gestion,
  argent,
  // Comme en production sans la migration 0008 : les écrans existants de Gérer restent inchangés.
  bail = clientBailIndisponible,
  // Comme en production sans la migration 0011 (ADR-G34).
  finBail = clientFinBailIndisponible,
  projets,
  partage,
  envois,
  accord,
  installation = suiviIndisponible,
}: {
  chemin?: string;
  stockage?: Storage;
  client?: ClientWorker;
  compte?: ClientCompte;
  gestion?: ClientGestion;
  argent?: ClientArgent;
  bail?: ClientBail;
  finBail?: ClientFinBail;
  projets?: ClientProjets;
  partage?: ClientPartage;
  envois?: ClientEnvois;
  accord?: ClientAccord;
  installation?: SuiviInstallation;
}): JSX.Element {
  const clientEnvois = useMemo(() => envois ?? clientEnvoisMemoire(), [envois]);
  const clientAccord = useMemo(() => accord ?? clientAccordMemoire(), [accord]);
  const clientCompte = useMemo(() => compte ?? clientMemoire(), [compte]);
  const clientGestion = useMemo(() => gestion ?? clientGestionMemoire(), [gestion]);
  const clientArgent = useMemo(() => argent ?? clientArgentMemoire(), [argent]);
  const clientProjets = useMemo(() => projets ?? clientProjetsMemoire(), [projets]);
  const clientPartage = useMemo(() => partage ?? clientPartageMemoire(), [partage]);
  return (
    <ProjetsProvider stockage={stockage}>
      <PartageProvider client={clientPartage} stockage={stockage}>
        <ClientWorkerProvider client={client}>
          <CompteProvider client={clientCompte}>
            <SynchroProvider client={clientProjets} delaiMs={0}>
              <GestionProvider client={clientGestion} stockage={stockage}>
                <ArgentProvider client={clientArgent}>
                  <EnvoisProvider client={clientEnvois} accord={clientAccord}>
                    <BailProvider client={bail}>
                      <FinBailProvider client={finBail}>
                        <InstallationProvider suivi={installation}>
                          <MemoryRouter initialEntries={[chemin]}>
                            <Racine />
                          </MemoryRouter>
                        </InstallationProvider>
                      </FinBailProvider>
                    </BailProvider>
                  </EnvoisProvider>
                </ArgentProvider>
              </GestionProvider>
            </SynchroProvider>
          </CompteProvider>
        </ClientWorkerProvider>
      </PartageProvider>
    </ProjetsProvider>
  );
}
