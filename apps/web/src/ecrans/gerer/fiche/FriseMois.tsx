import type { JSX } from 'react';

import { Bouton, Carte, Pastille, TitreCarte } from '@/composants/ui';
import type { MoisDuBien } from '@/gestion/fiche';
import { quittancePossible } from '@/gestion/loyers-page';
import {
  moisCourt,
  quittanceDuMois,
  STATUTS_FRISE,
  TEXTES_FICHE as F,
  TONS_FRISE,
} from '@/textes/gerer-fiche';

import type { ActionsLoyer } from '../useActionsLoyer';

/** Les douze derniers mois du bien : un statut en mot par mois, « Quittance » sur un mois reçu. */
export function FriseMois({
  frise,
  actions,
}: {
  readonly frise: readonly MoisDuBien[];
  readonly actions: ActionsLoyer;
}): JSX.Element {
  return (
    <Carte>
      <TitreCarte>{F.douzeMois}</TitreCarte>
      <ol
        aria-label={F.douzeMois}
        className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 lg:grid-cols-4"
      >
        {frise.map((mois) => (
          <li
            key={mois.periode}
            className="flex flex-col items-start gap-1.5 rounded-encart border border-bordure-douce p-2.5"
          >
            <span className="text-xs font-bold tracking-wider text-encre-3 uppercase">
              {moisCourt(mois.periode)}
            </span>
            <Pastille ton={TONS_FRISE[mois.statut]} compacte>
              {STATUTS_FRISE[mois.statut]}
            </Pastille>
            {mois.lignes.filter(quittancePossible).map((ligne) => (
              <Bouton
                key={ligne.location.id}
                disabled={actions.occupe}
                onClick={() =>
                  void actions.ouvrirDocument({
                    type: 'quittance',
                    locationId: ligne.location.id,
                    periode: mois.periode,
                  })
                }
              >
                {quittanceDuMois(ligne.location.libelle)}
              </Bouton>
            ))}
          </li>
        ))}
      </ol>
    </Carte>
  );
}
