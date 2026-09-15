import type { JSX } from 'react';
import { Link } from 'react-router';

import { TEXTES_PARCOURS as T } from '@/textes/gerer-parcours';

export interface EtapeAriane {
  readonly libelle: string;
  /** Absent pour la page affichée, toujours la dernière étape. */
  readonly vers?: string;
}

/** « Gérer › Mes biens › T2 Lices » au-dessus du titre : chaque étape sauf la dernière est un lien. */
export function FilAriane({ etapes }: { readonly etapes: readonly EtapeAriane[] }): JSX.Element {
  return (
    <nav aria-label={T.filAriane} className="min-w-0">
      <ol className="m-0 flex list-none flex-wrap items-center gap-x-1.5 p-0 text-sm text-encre-3">
        {etapes.map((etape, rang) => (
          <li key={etape.vers ?? 'ici'} className="flex min-w-0 items-center gap-1.5">
            {rang > 0 && <span aria-hidden="true">›</span>}
            {etape.vers === undefined ? (
              <span aria-current="page" className="truncate font-semibold text-encre-2">
                {etape.libelle}
              </span>
            ) : (
              <Link
                to={etape.vers}
                className="inline-flex items-center text-encre-3 no-underline survol-texte pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:justify-center"
              >
                {etape.libelle}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
