import { calculerProjet } from '@loupe/moteur';
import { Columns2, Info, Plus, Puzzle, Search, Settings } from 'lucide-react';
import type { JSX } from 'react';
import { NavLink, useNavigate } from 'react-router';

import { Point } from '@/composants/ui';
import { useProjets } from '@/stockage/ProjetsContext';
import type { ProjetEnregistre } from '@/stockage/projets';

const lien = ({ isActive }: { isActive: boolean }): string =>
  `flex min-h-[44px] items-center gap-3 rounded-encart px-3.5 py-2.5 text-[15px] font-semibold ${
    isActive ? 'bg-accent-doux text-encre' : 'text-encre-2 hover:bg-accent-fond'
  }`;

function feuCashflow(p: ProjetEnregistre): 'bon' | 'surveiller' | 'probleme' | 'inconnu' {
  return (
    calculerProjet(p.projet, { avecScenarios: false }).verdict.feux.find(
      (f) => f.axe === 'cashflow',
    )?.feu ?? 'inconnu'
  );
}

export function Sidebar(): JSX.Element {
  const { projets } = useProjets();
  const naviguer = useNavigate();

  const nouveau = (): void => {
    void naviguer('/projets/nouveau');
  };

  return (
    <aside className="flex h-full flex-col gap-5 border-r border-bordure bg-surface px-4 py-5">
      <NavLink
        to="/projets"
        className="flex items-center gap-2.5 px-2.5 font-display text-[22px] font-bold text-accent"
      >
        <Search size={26} strokeWidth={2.4} aria-hidden="true" />
        Loupe
      </NavLink>

      <button
        type="button"
        onClick={nouveau}
        className="flex min-h-[44px] items-center justify-center gap-3 rounded-encart bg-accent px-3.5 text-[15px] font-semibold text-white hover:bg-accent-fonce"
      >
        <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
        Nouveau projet
      </button>

      <nav aria-label="Mes projets" className="flex flex-col gap-1">
        <div className="px-3.5 pb-1.5 text-xs font-bold tracking-wider text-encre-4 uppercase">
          Mes projets
        </div>
        {projets.map((p) => (
          <NavLink key={p.id} to={`/projets/${p.id}`} className={lien}>
            <span className="flex-1 truncate">{p.nom}</span>
            <Point feu={feuCashflow(p)} />
          </NavLink>
        ))}
        <NavLink to="/comparer" className={lien}>
          <Columns2 size={18} aria-hidden="true" />
          Comparer
        </NavLink>
      </nav>

      <nav aria-label="Aide" className="flex flex-col gap-1">
        <NavLink to="/methode" className={lien}>
          <Info size={18} aria-hidden="true" />
          Comment c'est calculé
        </NavLink>
        <NavLink to="/extension" className={lien}>
          <Puzzle size={18} aria-hidden="true" />
          Extension navigateur
        </NavLink>
      </nav>

      <div className="flex-1" />

      <div className="flex items-center gap-3 border-t border-bordure px-2.5 pt-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-doux font-display text-[15px] font-bold text-accent">
          ?
        </div>
        <div className="flex flex-1 flex-col">
          <span className="text-[15px] font-bold">Sans compte</span>
          <span className="text-xs text-encre-3">
            Gratuit · {projets.length} {projets.length > 1 ? 'projets' : 'projet'}
          </span>
        </div>
        <Settings size={18} className="text-encre-3" aria-hidden="true" />
      </div>
    </aside>
  );
}
