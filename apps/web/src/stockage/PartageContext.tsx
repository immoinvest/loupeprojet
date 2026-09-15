import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { ClientPartage } from './partage-client';

/** Le client des liens courts et le stockage où l'appareil garde les liens qu'il a créés. */
export interface ContextePartage {
  readonly client: ClientPartage;
  readonly stockage: Storage;
}

const Contexte = createContext<ContextePartage | null>(null);

export function PartageProvider({
  client,
  stockage,
  children,
}: {
  readonly client: ClientPartage;
  readonly stockage?: Storage | undefined;
  readonly children: ReactNode;
}): ReactNode {
  const store = stockage ?? window.localStorage;
  const valeur = useMemo(() => ({ client, stockage: store }), [client, store]);
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function usePartage(): ContextePartage {
  const contexte = useContext(Contexte);
  if (contexte === null) throw new Error('usePartage doit être utilisé sous PartageProvider');
  return contexte;
}
