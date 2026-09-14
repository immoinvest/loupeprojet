import type { JSX } from 'react';
import { Outlet } from 'react-router';

import { BarreApp } from './BarreApp';
import { useRetourEnHaut } from './contenu';
import { useMenu } from './menu';
import { Sidebar } from './Sidebar';

/**
 * Coque de l'application. Elle tient dans la fenêtre et seul le contenu (`main`) défile : le menu
 * et, dans un projet, l'en-tête collé restent en place. À partir de 1 024 px : barre latérale et
 * contenu côte à côte. En dessous : barre d'app en haut, barre latérale en tiroir, contenu sur
 * toute la largeur. À l'impression, la page redevient un document d'une seule pièce.
 */
export function AppLayout(): JSX.Element {
  const menu = useMenu();
  useRetourEnHaut(menu.contenuRef);
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-fond lg:grid lg:grid-cols-[var(--largeur-menu)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] print:block print:h-auto print:overflow-visible">
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
        className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] print:overflow-visible"
      >
        <Outlet />
      </main>
    </div>
  );
}
