import { calculerProjet } from '@loupe/moteur';
import { Columns2, Plus } from 'lucide-react';
import type { JSX } from 'react';
import { NavLink } from 'react-router';

import { Point } from '@/composants/ui';
import { useProjets } from '@/stockage/ProjetsContext';
import type { ProjetEnregistre } from '@/stockage/projets';
import { PROJETS_DANS_LE_MENU, TEXTES_MENU, tousMesProjets } from '@/textes/gerer';

import { CLASSE_ETIQUETTE, classeLien, classeLienCreation } from './liens';

function feuCashflow(p: ProjetEnregistre): 'bon' | 'surveiller' | 'probleme' | 'inconnu' {
  return (
    calculerProjet(p.projet, { avecScenarios: false }).verdict.feux.find(
      (f) => f.axe === 'cashflow',
    )?.feu ?? 'inconnu'
  );
}

/** Section « Analyser » : nouveau projet, les projets les plus récents, Comparer. */
export function SectionAnalyser(): JSX.Element {
  const { projets } = useProjets();
  const recents = projets.slice(0, PROJETS_DANS_LE_MENU);

  return (
    <nav aria-label={TEXTES_MENU.analyser} className="flex flex-col gap-1">
      <div className={CLASSE_ETIQUETTE}>{TEXTES_MENU.analyser}</div>
      <NavLink to="/projets/nouveau" className={classeLienCreation}>
        <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
        {TEXTES_MENU.nouveauProjet}
      </NavLink>
      {recents.map((p) => (
        <NavLink key={p.id} to={`/projets/${p.id}`} className={classeLien}>
          <span className="flex-1 truncate">{p.nom}</span>
          <Point feu={feuCashflow(p)} />
        </NavLink>
      ))}
      {projets.length > PROJETS_DANS_LE_MENU && (
        <NavLink to="/projets" end className={classeLien}>
          <span className="flex-1 truncate text-encre-3">{tousMesProjets(projets.length)}</span>
        </NavLink>
      )}
      <NavLink to="/comparer" className={classeLien}>
        <Columns2 size={18} aria-hidden="true" />
        {TEXTES_MENU.comparer}
      </NavLink>
    </nav>
  );
}
