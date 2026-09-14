import type { IdentiteBailleur as Identite } from '@loupe/gestion';
import type { JSX } from 'react';

import { TEXTES_GERER as T } from '@/textes/gerer-ecrans';

import { IdentiteBailleur } from './IdentiteBailleur';
import type { ActionsLoyer } from './useActionsLoyer';

/**
 * Ce que les actions d'un loyer rendent à l'écran : la carte d'identité du bailleur quand un
 * document l'attend, le bandeau « Annuler » après un paiement, et l'erreur de la dernière action.
 */
export function RetoursLoyer({
  actions,
  bailleur,
}: {
  readonly actions: ActionsLoyer;
  readonly bailleur: Identite | null;
}): JSX.Element {
  const { annulation, erreur, identite, occupe } = actions;
  return (
    <>
      {identite !== null && (
        <IdentiteBailleur
          initiale={bailleur}
          occupe={occupe}
          erreur={identite.erreur}
          onEnregistrer={(saisie) => actions.enregistrerIdentite(identite.demande, saisie)}
          onAnnuler={actions.abandonnerIdentite}
        />
      )}
      {annulation !== null && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-encart bg-encre px-4 py-2 text-[15px] font-semibold text-white"
        >
          {annulation.message}
          <button
            type="button"
            disabled={occupe}
            onClick={() => void actions.annuler(annulation)}
            className="min-h-[44px] rounded-full bg-white/15 px-4 text-sm font-semibold text-white hover:bg-white/25"
          >
            {T.annuler}
          </button>
        </div>
      )}
      {erreur !== null && (
        <p
          role="alert"
          className="m-0 rounded-encart bg-probleme-fond p-3 text-sm text-probleme-texte"
        >
          {erreur}
        </p>
      )}
    </>
  );
}
