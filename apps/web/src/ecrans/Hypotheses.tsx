import type { JSX } from 'react';

import { Page, TitrePage } from '@/composants/mise-en-page';
import { Carte, Pastille } from '@/composants/ui';
import { useProjetCourant } from '@/coque/ProjetLayout';
import { eurosParMois, pourcentage } from '@/formatage/nombres';
import { GROUPES } from '@/hypotheses';

import { GrilleHypotheses } from './hypotheses/GrilleHypotheses';

function Synthese(): JSX.Element {
  const { resultats: r } = useProjetCourant();
  const cf = r.cashflow.mensuel;
  const couverture = r.verdict.feux.find((f) => f.axe === 'couverture');
  const kpis = [
    { l: 'Cash-flow', v: eurosParMois(cf), ton: cf >= 0 ? 'text-bon' : 'text-probleme' },
    { l: 'Rendement net', v: pourcentage(r.rendement.rendements.net), ton: '' },
    { l: 'TRI', v: r.rendement.tri === null ? '—' : pourcentage(r.rendement.tri), ton: '' },
    {
      l: 'Crédit ÷ loyer',
      v: couverture?.valeur == null ? '—' : pourcentage(couverture.valeur, 0),
      ton: couverture?.feu === 'probleme' ? 'text-probleme' : '',
    },
  ];
  return (
    <div className="sticky top-[var(--hauteur-entete-projet,0px)] z-10 -mx-4 grid grid-cols-2 gap-x-6 gap-y-2 border-b border-bordure bg-fond/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:flex sm:items-center sm:gap-8 sm:px-6 lg:-mx-10 lg:px-10">
      {kpis.map((k) => (
        <div key={k.l} className="flex flex-col">
          <span className="text-xs text-encre-3">{k.l}</span>
          <span className={`font-display text-lg font-bold sm:text-xl ${k.ton}`}>{k.v}</span>
        </div>
      ))}
      <span className="ml-auto hidden text-sm text-encre-3 sm:inline">
        Recalculé à chaque modification.
      </span>
    </div>
  );
}

export function Hypotheses(): JSX.Element {
  const { enregistre } = useProjetCourant();

  return (
    <Page haut="serre">
      <Synthese />
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <TitrePage taille="section">Vos hypothèses</TitrePage>
        <span className="flex flex-wrap items-center gap-2 text-sm text-encre-3">
          <Pastille ton="neutre" compacte>
            annonce
          </Pastille>
          <Pastille ton="surveiller" compacte>
            estimé
          </Pastille>
          <Pastille ton="accent" compacte>
            à toi
          </Pastille>
          Chaque valeur dit d'où elle vient. Le prêt se règle dans Financement.
        </span>
      </div>
      {GROUPES.map((g) => (
        <Carte key={g.titre}>
          <h2 className="m-0 font-display text-[22px] font-semibold">{g.titre}</h2>
          {g.sousTitre !== undefined && <p className="m-0 text-sm text-encre-2">{g.sousTitre}</p>}
          <GrilleHypotheses key={enregistre.id} groupe={g} />
        </Carte>
      ))}
    </Page>
  );
}
