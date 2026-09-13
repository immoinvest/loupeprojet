import { createContext, useContext, type JSX, type ReactNode } from 'react';

import { clientHorsLigne, type ClientWorker } from '@/enrichissement';

/** Sans fournisseur, l'application tourne hors ligne : lecture par règles, projets sans marché. */
const Contexte = createContext<ClientWorker>(clientHorsLigne);

export function ClientWorkerProvider({
  client,
  children,
}: {
  client: ClientWorker;
  children: ReactNode;
}): JSX.Element {
  return <Contexte.Provider value={client}>{children}</Contexte.Provider>;
}

export function useClientWorker(): ClientWorker {
  return useContext(Contexte);
}
