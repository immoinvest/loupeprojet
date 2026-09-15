import type { ResultatRegime } from '@loupe/moteur';
import type { JSX } from 'react';

import { euros } from '@/formatage/nombres';
import { REGIMES } from '@/textes/regimes';

/**
 * Pour chaque régime, une barre en deux segments : l'impôt pendant la location, puis l'impôt à la
 * revente. Les montants restent écrits sous chaque barre : c'est la version lue par les lecteurs
 * d'écran et sur papier. Un impôt négatif (déficit foncier) compte pour zéro dans la barre.
 */
export function ImpotsEmpiles({
  regimes,
  annees,
}: {
  regimes: readonly ResultatRegime[];
  annees: number;
}): JSX.Element {
  const plusHaut = Math.max(1, ...regimes.map((r) => Math.max(0, r.impotTotal) + r.impotRevente));
  const part = (montant: number): string => `${String((Math.max(0, montant) / plusHaut) * 100)}%`;
  return (
    <div className="flex flex-col gap-3">
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {regimes.map((r) => (
          <li key={r.regime} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className="font-semibold">{REGIMES[r.regime]}</span>
              <span className="font-bold tabular-nums">{euros(r.impotGlobal)}</span>
            </div>
            <div
              aria-hidden="true"
              className="flex h-4 overflow-hidden rounded-[4px] bg-bordure-douce print:[print-color-adjust:exact]"
            >
              <div className="h-full bg-accent" style={{ width: part(r.impotTotal) }} />
              <div className="h-full bg-surveiller" style={{ width: part(r.impotRevente) }} />
            </div>
            <p className="m-0 text-[13px] text-encre-3">
              Pendant {annees} ans : {euros(r.impotTotal)} · à la revente : {euros(r.impotRevente)}
            </p>
          </li>
        ))}
      </ul>
      <div aria-hidden="true" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-encre-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-[3px] bg-accent" /> pendant la location
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-[3px] bg-surveiller" /> à la revente
        </span>
      </div>
    </div>
  );
}
