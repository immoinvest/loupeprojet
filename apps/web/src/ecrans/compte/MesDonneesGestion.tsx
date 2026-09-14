import type { JSX } from 'react';

import { Carte, TitreCarte } from '@/composants/ui';
import { CHEMIN_EXPORT } from '@/gestion/reseau';
import { TEXTES_EXPORT as T } from '@/textes/gerer';

/**
 * Carte « Mes données de gestion » : un simple lien. La réponse de l'API est une pièce jointe
 * (Content-Disposition), le navigateur l'enregistre sans quitter la page.
 */
export function MesDonneesGestion(): JSX.Element {
  return (
    <Carte>
      <TitreCarte>{T.titre}</TitreCarte>
      <p className="m-0 text-sm text-encre-2">{T.phrase}</p>
      <div>
        <a
          href={CHEMIN_EXPORT}
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-bordure bg-surface px-4 text-sm font-semibold text-encre-2 no-underline hover:bg-accent-fond"
        >
          {T.exporter}
        </a>
      </div>
    </Carte>
  );
}
