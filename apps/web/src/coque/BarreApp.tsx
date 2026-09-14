import { Menu as IconeMenu } from 'lucide-react';
import type { JSX } from 'react';
import { NavLink } from 'react-router';

import { LogotypeDeklic } from '@/marque/Logo';

import type { Menu } from './menu';
import { ID_NAVIGATION } from './Sidebar';

/**
 * Barre d'app des écrans de moins de 1 024 px : le bouton de menu et le logo. Sa hauteur vient de
 * `--hauteur-barre-app` (index.css), que les éléments collants et les ancres utilisent aussi.
 */
export function BarreApp({ menu }: { menu: Menu }): JSX.Element {
  return (
    <header
      inert={menu.ouvert}
      className="sticky top-0 z-20 flex h-[var(--hauteur-barre-app)] items-center gap-1 border-b border-bordure bg-surface/95 pt-[env(safe-area-inset-top)] pr-[max(0.5rem,env(safe-area-inset-right))] pl-[max(0.5rem,env(safe-area-inset-left))] backdrop-blur lg:hidden print:hidden"
    >
      <button
        ref={menu.boutonRef}
        type="button"
        onClick={menu.ouvrir}
        aria-label="Ouvrir le menu"
        aria-expanded={menu.ouvert}
        aria-controls={ID_NAVIGATION}
        className="flex h-11 w-11 items-center justify-center rounded-full text-encre-2 hover:bg-accent-fond"
      >
        <IconeMenu size={22} aria-hidden="true" />
      </button>
      <NavLink to="/projets" className="flex min-h-11 items-center px-1">
        <LogotypeDeklic hauteur={24} />
      </NavLink>
    </header>
  );
}
