import { Menu as IconeMenu } from 'lucide-react';
import type { JSX } from 'react';
import { NavLink } from 'react-router';

import { LogotypeDeklic } from '@/marque/Logo';
import { TEXTES_LOGO } from '@/textes/accueil';

import type { Menu } from './menu';
import { ID_NAVIGATION } from './Sidebar';

/**
 * Barre d'app des écrans de moins de 1 024 px : le bouton de menu et le logo. Elle est hors du
 * contenu qui défile, donc toujours en vue ; sa hauteur vient de `--hauteur-barre-app` (index.css).
 */
export function BarreApp({ menu }: { menu: Menu }): JSX.Element {
  return (
    <header
      inert={menu.ouvert}
      className="flex h-[var(--hauteur-barre-app)] shrink-0 items-center gap-1 border-b border-bordure bg-surface pt-[env(safe-area-inset-top)] pr-[max(0.5rem,env(safe-area-inset-right))] pl-[max(0.5rem,env(safe-area-inset-left))] lg:hidden print:hidden"
    >
      <button
        ref={menu.boutonRef}
        type="button"
        onClick={menu.ouvrir}
        aria-label="Ouvrir le menu"
        aria-expanded={menu.ouvert}
        aria-controls={ID_NAVIGATION}
        className="flex h-11 w-11 items-center justify-center rounded-full text-encre-2 survol-fond"
      >
        <IconeMenu size={22} aria-hidden="true" />
      </button>
      <NavLink
        to="/"
        aria-label={TEXTES_LOGO}
        className="flex min-h-11 items-center rounded-encart px-1 survol-fond"
      >
        <LogotypeDeklic hauteur={24} />
      </NavLink>
    </header>
  );
}
