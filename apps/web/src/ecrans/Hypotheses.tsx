import type { ProjetEntree } from '@loupe/moteur';
import { useState, type JSX } from 'react';

import { Page, TitrePage } from '@/composants/mise-en-page';
import { Carte, Pastille } from '@/composants/ui';
import { useProjetCourant } from '@/coque/ProjetLayout';
import { eurosParMois, pourcentage } from '@/formatage/nombres';
import {
  GROUPES,
  appliquerSaisie,
  valeurActuelle,
  versTexte,
  type Descripteur,
} from '@/hypotheses';
import { useProjets } from '@/stockage/ProjetsContext';

import { ChampHypothese } from './hypotheses/ChampHypothese';
import { badgePour } from './hypotheses/badges';

function Synthese(): JSX.Element {
  const { resultats: r } = useProjetCourant();
  const cf = r.cashflow.mensuel;
  const kpis = [
    { l: 'Cash-flow', v: eurosParMois(cf), ton: cf >= 0 ? 'text-bon' : 'text-probleme' },
    { l: 'Rendement net', v: pourcentage(r.rendement.rendements.net), ton: '' },
    { l: 'TRI', v: r.rendement.tri === null ? '—' : pourcentage(r.rendement.tri), ton: '' },
    {
      l: 'Effort bancaire',
      v: r.financement.effort.hcsf === null ? '—' : pourcentage(r.financement.effort.hcsf, 0),
      ton: r.financement.effort.depasseHcsf ? 'text-probleme' : '',
    },
  ];
  return (
    <div className="sticky top-[var(--hauteur-barre-app)] z-10 -mx-4 grid grid-cols-2 gap-x-6 gap-y-2 border-b border-bordure bg-fond/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:flex sm:items-center sm:gap-8 sm:px-6 lg:-mx-10 lg:px-10">
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
  const { mettreAJour } = useProjets();
  const projet: ProjetEntree = enregistre.projet;
  const [textes, setTextes] = useState<Readonly<Record<string, string>>>({});
  const [erreurs, setErreurs] = useState<Readonly<Record<string, string>>>({});

  const changer = (d: Descripteur, texte: string): void => {
    setTextes((prev) => ({ ...prev, [d.chemin]: texte }));
    const application = appliquerSaisie(projet, d, texte);
    if (!application.ok) {
      setErreurs((prev) => ({ ...prev, [d.chemin]: application.erreur }));
      return;
    }
    const resultat = mettreAJour(enregistre.id, application.projet);
    if (!resultat.ok) {
      const message =
        resultat.erreurs[d.chemin] ?? Object.values(resultat.erreurs)[0] ?? 'Valeur refusée.';
      setErreurs((prev) => ({ ...prev, [d.chemin]: message }));
      return;
    }
    setErreurs((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== d.chemin)));
  };

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
          Chaque valeur dit d'où elle vient.
        </span>
      </div>
      {GROUPES.map((g) => {
        const visibles = g.champs.filter((d) => d.visibleSi === undefined || d.visibleSi(projet));
        return (
          <Carte key={g.titre}>
            <h2 className="m-0 font-display text-[22px] font-semibold">{g.titre}</h2>
            {g.sousTitre !== undefined && <p className="m-0 text-sm text-encre-2">{g.sousTitre}</p>}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {visibles.map((d) => (
                <ChampHypothese
                  key={d.chemin}
                  descripteur={d}
                  texte={textes[d.chemin] ?? versTexte(valeurActuelle(projet, d), d.type)}
                  erreur={erreurs[d.chemin]}
                  badge={badgePour(projet, d)}
                  onChange={(t) => {
                    changer(d, t);
                  }}
                />
              ))}
            </div>
          </Carte>
        );
      })}
    </Page>
  );
}
