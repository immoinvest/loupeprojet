import type { JSX } from 'react';

import { Carte, GrosChiffre, TitreCarte } from '@/composants/ui';
import { TEXTES_A_COMPLETER } from '@/textes/manques';

/** Une carte du rapport dont le chiffre attend une donnée : même question, « À compléter » à la place. */
export function CarteACompleter({ titre }: { titre: string }): JSX.Element {
  return (
    <Carte className="border-dashed border-bordure">
      <TitreCarte>{titre}</TitreCarte>
      <GrosChiffre ton="encre">
        <span className="text-encre-3">{TEXTES_A_COMPLETER.titre}</span>
      </GrosChiffre>
      <p className="m-0 text-[15px] text-encre-2">{TEXTES_A_COMPLETER.phrase}</p>
    </Carte>
  );
}
