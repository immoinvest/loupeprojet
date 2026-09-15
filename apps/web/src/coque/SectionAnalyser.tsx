import { calculerProjet } from '@loupe/moteur';
import type { JSX } from 'react';
import { NavLink } from 'react-router';

import { Point } from '@/composants/ui';
import { useProjets } from '@/stockage/ProjetsContext';
import type { ProjetEnregistre } from '@/stockage/projets';
import { mesProjets, PROJETS_DANS_LE_MENU, TEXTES_MENU } from '@/textes/gerer';

import { LigneAvecAjout } from './LigneAvecAjout';
import { CLASSE_ETIQUETTE, classeLien } from './liens';

function feuCashflow(p: ProjetEnregistre): 'bon' | 'surveiller' | 'probleme' | 'inconnu' {
  return (
    calculerProjet(p.projet, { avecScenarios: false }).verdict.feux.find(
      (f) => f.axe === 'cashflow',
    )?.feu ?? 'inconnu'
  );
}

/**
 * Section « Analyser » : « Mes projets · N » et son « + » sur une ligne (la liste garde Comparer),
 * puis les trois projets les plus récents.
 */
export function SectionAnalyser(): JSX.Element {
  const { projets } = useProjets();
  const recents = projets.slice(0, PROJETS_DANS_LE_MENU);

  return (
    <nav aria-label={TEXTES_MENU.analyser} className="flex flex-col gap-1">
      <div className={CLASSE_ETIQUETTE}>{TEXTES_MENU.analyser}</div>
      <LigneAvecAjout
        vers="/projets"
        libelle={mesProjets(projets.length)}
        versAjout="/projets/nouveau"
        libelleAjout={TEXTES_MENU.nouveauProjet}
      />
      {recents.map((p) => (
        <NavLink key={p.id} to={`/projets/${p.id}`} className={classeLien}>
          <span className="flex-1 truncate">{p.nom}</span>
          <Point feu={feuCashflow(p)} />
        </NavLink>
      ))}
    </nav>
  );
}
