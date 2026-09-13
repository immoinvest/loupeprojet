import type { JSX } from 'react';
import { Outlet } from 'react-router';

import { BarreApp } from './BarreApp';
import { useMenu } from './menu';
import { Sidebar } from './Sidebar';

/**
 * Coque de l'application. À partir de 1 024 px : barre latérale et contenu côte à côte.
 * En dessous : barre d'app en haut, barre latérale en tiroir, contenu sur toute la largeur.
 */
export function AppLayout(): JSX.Element {
  const menu = useMenu();
  return (
    <div className="min-h-dvh bg-fond lg:grid lg:grid-cols-[248px_minmax(0,1fr)] print:block">
      <BarreApp menu={menu} />
      {menu.ouvert && (
        <div
          aria-hidden="true"
          data-voile
          onClick={menu.fermer}
          className="fixed inset-0 z-30 bg-encre/40 lg:hidden print:hidden"
        />
      )}
      <Sidebar ouvert={menu.ouvert} onFermer={menu.fermer} />
      {/* Téléphone à encoche (viewport-fit=cover) : le contenu reste hors des zones masquées. */}
      <main
        ref={menu.contenuRef}
        tabIndex={-1}
        inert={menu.ouvert}
        className="min-w-0 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]"
      >
        <Outlet />
      </main>
    </div>
  );
}
