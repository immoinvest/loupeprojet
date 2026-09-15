import type { ResultatRegime } from '@loupe/moteur';
import type { JSX } from 'react';

import { LIGNES_REVENTE, REGIMES } from '@/textes/regimes';

/** « La revente selon le régime » : une ligne par étape du calcul, une colonne par régime. */
export function TableauRevente({ regimes }: { regimes: readonly ResultatRegime[] }): JSX.Element {
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs text-encre-3">
            <th className="sticky left-0 bg-surface py-2 pr-3 font-semibold">
              <span className="sr-only">Étape</span>
            </th>
            {regimes.map((r) => (
              <th key={r.regime} scope="col" className="py-2 pr-3 text-right font-semibold">
                {REGIMES[r.regime]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LIGNES_REVENTE.map((ligne) => (
            <tr
              key={ligne.titre}
              className={`border-t border-bordure-douce ${ligne.fort === true ? 'font-bold' : ''}`}
            >
              <th
                scope="row"
                className="sticky left-0 bg-surface py-2 pr-3 text-left font-semibold"
              >
                {ligne.titre}
              </th>
              {regimes.map((r) => (
                <td key={r.regime} className="py-2 pr-3 text-right whitespace-nowrap">
                  {ligne.valeur(r.revente)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
