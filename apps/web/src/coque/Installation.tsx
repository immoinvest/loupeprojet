import { createContext, useContext, useSyncExternalStore, type JSX, type ReactNode } from 'react';

import {
  suiviIndisponible,
  type EtatInstallation,
  type ResultatInstallation,
  type SuiviInstallation,
} from '@/application';

/** Sans fournisseur, rien à installer (tests, rendu hors navigateur). */
const Contexte = createContext<SuiviInstallation>(suiviIndisponible);

export function InstallationProvider({
  suivi,
  children,
}: {
  suivi: SuiviInstallation;
  children: ReactNode;
}): JSX.Element {
  return <Contexte.Provider value={suivi}>{children}</Contexte.Provider>;
}

export interface Installation {
  readonly etat: EtatInstallation;
  readonly installer: () => Promise<ResultatInstallation>;
}

/** L'état d'installation, tenu à jour par les événements du navigateur. */
export function useInstallation(): Installation {
  const suivi = useContext(Contexte);
  const etat = useSyncExternalStore(suivi.abonner, suivi.lire, suivi.lire);
  return { etat, installer: suivi.installer };
}
