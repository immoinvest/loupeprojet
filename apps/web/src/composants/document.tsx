import { createContext, useContext, type JSX, type ReactNode } from 'react';

const Contexte = createContext(false);

/**
 * Rendu « document » : lecture seule, explications dépliées, mise en page pensée pour
 * le papier. Utilisé par l'impression et par la page de partage.
 */
export function ModeDocument({ children }: { children: ReactNode }): JSX.Element {
  return <Contexte.Provider value={true}>{children}</Contexte.Provider>;
}

export function useModeDocument(): boolean {
  return useContext(Contexte);
}
