import type { JSX } from 'react';

import { Carte } from '@/composants/ui';
import type { ReponseAdresse } from '@/enrichissement';
import { LIBELLES_GROUPES, prixM2 } from '@/textes/adresse';

export { TableauVentes } from './TableauVentes';

const CELLULE = 'border-b border-bordure-douce px-3 py-2 text-left align-top';
const ENTETE =
  'border-b border-bordure px-3 py-2 text-left text-xs font-bold text-encre-3 uppercase';

/** Première colonne collante : elle reste visible quand le tableau défile au doigt. */
const COLLANTE = 'sticky left-0 z-[1]';

const SANS_VALEUR = '—';

/** Une ligne par groupe : du même immeuble au cercle de 300 m, avec la vente la moins chère et la plus chère. */
export function TableauGroupes({ analyse }: { analyse: ReponseAdresse }): JSX.Element {
  return (
    <Carte>
      <h2 className="m-0 font-display text-[22px] font-semibold">
        Les ventes, du plus près au plus large
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[15px]">
          <thead>
            <tr>
              <th className={`${ENTETE} ${COLLANTE} bg-surface`}>Où</th>
              <th className={ENTETE}>Ventes</th>
              <th className={ENTETE}>Comparables</th>
              <th className={ENTETE}>Médiane</th>
              <th className={ENTETE}>Moitié des ventes entre</th>
              <th className={ENTETE}>Min</th>
              <th className={ENTETE}>Max</th>
            </tr>
          </thead>
          <tbody>
            {analyse.groupes.map((g) => {
              const reference = analyse.reference?.code === g.code;
              const s = g.statistiques;
              return (
                <tr key={g.code} className={reference ? 'bg-accent-fond' : ''}>
                  <th
                    scope="row"
                    className={`${CELLULE} ${COLLANTE} font-semibold ${
                      reference ? 'bg-accent-fond' : 'bg-surface'
                    }`}
                  >
                    {LIBELLES_GROUPES[g.code]}
                  </th>
                  <td className={CELLULE}>{g.ventes}</td>
                  <td className={CELLULE}>{g.comparables}</td>
                  <td className={CELLULE}>{s === null ? SANS_VALEUR : prixM2(s.medianeM2)}</td>
                  <td className={CELLULE}>
                    {s === null ? SANS_VALEUR : `${prixM2(s.q1M2)} et ${prixM2(s.q3M2)}`}
                  </td>
                  <td className={CELLULE}>{s === null ? SANS_VALEUR : prixM2(s.minM2)}</td>
                  <td className={CELLULE}>{s === null ? SANS_VALEUR : prixM2(s.maxM2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Carte>
  );
}
