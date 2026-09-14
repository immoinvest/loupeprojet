import type { JSX } from 'react';

import { Carte } from '@/composants/ui';
import type { TendanceAdresse } from '@/enrichissement';
import { nombre } from '@/formatage/nombres';
import { prixM2 } from '@/textes/adresse';
import { phraseTendance } from '@/textes/estimation';

/**
 * Barres du prix au m² lissé par semestre, sans bibliothèque de graphiques. Sur un écran étroit, la
 * courbe défile dans sa carte plutôt que de serrer ses libellés les uns sur les autres.
 */
export function Tendance({ tendance }: { tendance: TendanceAdresse }): JSX.Element {
  const indices = tendance.points.map((p) => p.indice);
  const haut = Math.max(...indices);
  const bas = Math.min(...indices) * 0.9;
  return (
    <Carte>
      <h2 className="m-0 font-display text-[22px] font-semibold">L'évolution des prix ici</h2>
      <p className="m-0 text-[15px] text-encre-2">{phraseTendance(tendance)}</p>
      <div className="overflow-x-auto">
        <ol
          aria-label="Prix au m² par semestre"
          className="m-0 flex h-[180px] list-none items-end gap-2 p-0"
        >
          {tendance.points.map((p) => (
            <li
              key={p.periode}
              className="flex h-full min-w-16 flex-1 flex-col items-center justify-end gap-1"
            >
              <span className="text-xs font-semibold text-encre-2">{prixM2(p.indice)}</span>
              <span
                className="w-full rounded-t-md bg-accent/70"
                style={{ height: `${String(((p.indice - bas) / (haut - bas || 1)) * 70 + 10)}%` }}
              />
              <span className="text-xs text-encre-3">{p.periode.replace('-', ' ')}</span>
              <span className="text-[11px] text-encre-3">{nombre(p.ventes)} ventes</span>
            </li>
          ))}
        </ol>
      </div>
    </Carte>
  );
}
