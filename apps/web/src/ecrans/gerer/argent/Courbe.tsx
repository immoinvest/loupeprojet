import type { PointCourbe } from '@loupe/gestion';
import type { JSX } from 'react';

import { moisEnLettres } from '@/gestion/format';
import { moisCourt, montantSigne, TEXTES_ARGENT as T } from '@/textes/gerer-argent';

/**
 * Le cash-flow réel des 12 mois, en barres HTML (aucune bibliothèque) : au-dessus du trait quand le
 * mois a rapporté, en dessous quand il a coûté. Chaque mois se lit en toutes lettres (texte masqué).
 */
export function Courbe({ points }: { readonly points: readonly PointCourbe[] }): JSX.Element {
  const echelle = Math.max(1, ...points.map((p) => Math.abs(p.cashflow)));
  return (
    <ol aria-label={T.courbe} className="m-0 grid list-none grid-cols-12 gap-1 p-0">
      {points.map((p) => {
        const hauteur = `${String(Math.round((Math.abs(p.cashflow) / echelle) * 100))}%`;
        return (
          <li key={p.periode} className="relative flex min-w-0 flex-col">
            <div aria-hidden="true" className="flex h-16 flex-col justify-end">
              {p.cashflow > 0 && <div className="rounded-t bg-bon" style={{ height: hauteur }} />}
            </div>
            <div aria-hidden="true" className="h-px bg-bordure" />
            <div aria-hidden="true" className="flex h-16 flex-col justify-start">
              {p.cashflow < 0 && (
                <div className="rounded-b bg-probleme" style={{ height: hauteur }} />
              )}
            </div>
            <small
              aria-hidden="true"
              className="truncate pt-1 text-center text-[11px] text-encre-3"
            >
              {moisCourt(p.periode)}
            </small>
            <small className="sr-only">{`${moisEnLettres(p.periode)} : ${montantSigne(p.cashflow)}`}</small>
          </li>
        );
      })}
    </ol>
  );
}
