import type { JSX } from 'react';
import { Link } from 'react-router';

import { Bouton, Carte, Pastille, TitreCarte } from '@/composants/ui';
import type { MoisDuBien } from '@/gestion/fiche';
import { quittancePossible } from '@/gestion/loyers-page';
import { lienLoyers } from '@/gestion/parcours';
import {
  moisCourt,
  quittanceDuMois,
  STATUTS_FRISE,
  TEXTES_FICHE as F,
  TONS_FRISE,
} from '@/textes/gerer-fiche';

import type { ActionsLoyer } from '../useActionsLoyer';

/**
 * Les douze derniers mois d'un bien (ou les loyers d'un locataire) : un statut en mot par mois,
 * « Quittance » sur un mois reçu.
 */
export function FriseMois({
  frise,
  actions,
  titre = F.douzeMois,
  vide,
  bienId,
}: {
  readonly frise: readonly MoisDuBien[];
  readonly actions: ActionsLoyer;
  readonly titre?: string;
  /** Le bien mis en évidence sur la page du mois ; sans lui (fiche d'un locataire), celui du loyer. */
  readonly bienId?: string;
  /** La phrase d'une frise sans aucun mois (un locataire qui ne devait rien ces douze mois). */
  readonly vide?: string;
}): JSX.Element {
  if (frise.length === 0) {
    return (
      <Carte>
        <TitreCarte>{titre}</TitreCarte>
        <p className="m-0 text-encre-3">{vide}</p>
      </Carte>
    );
  }
  return (
    <Carte>
      <TitreCarte>{titre}</TitreCarte>
      <ol
        aria-label={titre}
        className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 lg:grid-cols-4"
      >
        {frise.map((mois) => (
          <li
            key={mois.periode}
            className="flex flex-col items-start gap-1.5 rounded-encart border border-bordure-douce p-2.5"
          >
            {/* Le mois mène à ses loyers, la ligne du bien mise en évidence. */}
            <Link
              to={lienLoyers({
                periode: mois.periode,
                bienId: bienId ?? mois.lignes[0]?.location.bienId,
              })}
              className="inline-flex items-center text-xs font-bold tracking-wider text-encre-3 uppercase no-underline survol-texte pointer-coarse:min-h-11"
            >
              {moisCourt(mois.periode)}
            </Link>
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
