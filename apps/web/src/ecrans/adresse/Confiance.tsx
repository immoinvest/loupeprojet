import type { JSX } from 'react';

import { Carte, Pastille } from '@/composants/ui';
import { useProjetCourant } from '@/coque/ProjetLayout';
import {
  LIBELLES_COMPOSANTES,
  PHRASES_CONFIANCE,
  phraseNote,
  pointsSurMaximum,
  raisonComposante,
  TON_CONFIANCE,
} from '@/textes/confiance';

/**
 * En tête de l'onglet Estimation : la note de confiance et ses quatre raisons en clair, chacune avec
 * ses points. Calculée par le moteur sur le repère du projet, sans réseau.
 */
export function CarteConfiance(): JSX.Element {
  const { resultats } = useProjetCourant();
  const e = resultats.estimation;
  if (e === null) {
    return (
      <Carte>
        <h2 className="m-0 font-display text-[22px] font-semibold">{PHRASES_CONFIANCE.titre}</h2>
        <p className="m-0 text-[15px] text-encre-2">{PHRASES_CONFIANCE.sansRepere}</p>
      </Carte>
    );
  }
  const c = e.confiance;
  return (
    <Carte>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="m-0 font-display text-[22px] font-semibold">{PHRASES_CONFIANCE.titre}</h2>
        <Pastille ton={TON_CONFIANCE[c.niveau]} compacte>
          {phraseNote(c)}
        </Pastille>
      </div>
      <ul
        aria-label="Les raisons de la note"
        className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2"
      >
        {c.composantes.map((x) => (
          <li
            key={x.code}
            className="flex flex-col gap-0.5 rounded-encart border border-bordure bg-surface px-3 py-2"
          >
            <span className="flex items-baseline justify-between gap-2 text-sm font-semibold text-encre-2">
              {LIBELLES_COMPOSANTES[x.code]}
              <span className="font-display text-base font-bold text-encre">
                {pointsSurMaximum(x)}
              </span>
            </span>
            <span className="text-[15px]">{raisonComposante(x, c)}</span>
          </li>
        ))}
      </ul>
      {c.precision === 'commune' && (
        <p className="m-0 text-[15px] text-encre-2">{PHRASES_CONFIANCE.affiner}</p>
      )}
    </Carte>
  );
}
