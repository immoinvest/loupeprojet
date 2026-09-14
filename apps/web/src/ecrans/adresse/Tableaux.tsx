import type { JSX } from 'react';

import { Carte, Pastille } from '@/composants/ui';
import type { ReponseAdresse } from '@/enrichissement';
import { dateCourte, euros, nombre } from '@/formatage/nombres';
import { LIBELLES_GROUPES, prixM2 } from '@/textes/adresse';

const CELLULE = 'border-b border-bordure-douce px-3 py-2 text-left align-top';
const ENTETE =
  'border-b border-bordure px-3 py-2 text-left text-xs font-bold text-encre-3 uppercase';

/** Première colonne collante : elle reste visible quand le tableau défile au doigt. */
const COLLANTE = 'sticky left-0 z-[1]';

/** Une ligne par groupe : du même immeuble au cercle de 300 m. */
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
            </tr>
          </thead>
          <tbody>
            {analyse.groupes.map((g) => {
              const reference = analyse.reference?.code === g.code;
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
                  <td className={CELLULE}>
                    {g.statistiques === null ? '—' : prixM2(g.statistiques.medianeM2)}
                  </td>
                  <td className={CELLULE}>
                    {g.statistiques === null
                      ? '—'
                      : `${prixM2(g.statistiques.q1M2)} et ${prixM2(g.statistiques.q3M2)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Carte>
  );
}

/** Les ventes comparables les plus proches, avec leur place par rapport au bien. */
export function TableauVentes({ analyse }: { analyse: ReponseAdresse }): JSX.Element | null {
  if (analyse.ventesProches.length === 0) return null;
  return (
    <Carte>
      <h2 className="m-0 font-display text-[22px] font-semibold">
        Les ventes comparables les plus proches
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[15px]">
          <thead>
            <tr>
              <th className={`${ENTETE} ${COLLANTE} bg-surface`}>Date</th>
              <th className={ENTETE}>Adresse</th>
              <th className={ENTETE}>Surface</th>
              <th className={ENTETE}>Prix</th>
              <th className={ENTETE}>Prix au m²</th>
              <th className={ENTETE}>Au prix d'aujourd'hui</th>
              <th className={ENTETE}>Distance</th>
              <th className={ENTETE}>Place</th>
            </tr>
          </thead>
          <tbody>
            {analyse.ventesProches.map((v, i) => (
              <tr key={`${v.date}-${String(i)}`}>
                <td className={`${CELLULE} ${COLLANTE} bg-surface`}>{dateCourte(v.date)}</td>
                <td className={CELLULE}>{v.adresse ?? '—'}</td>
                <td className={CELLULE}>{nombre(v.surface)} m²</td>
                <td className={CELLULE}>{euros(v.prix)}</td>
                <td className={CELLULE}>{prixM2(v.prixM2)}</td>
                <td className={CELLULE}>
                  {prixM2(v.prixM2Corrige ?? v.prixM2Actualise ?? v.prixM2)}
                </td>
                <td className={CELLULE}>
                  {v.distanceMetres === null ? '—' : `${String(v.distanceMetres)} m`}
                </td>
                <td className={CELLULE}>
                  <div className="flex flex-wrap gap-1">
                    {v.groupes
                      .filter((code) => !code.startsWith('rayon_'))
                      .map((code) => (
                        <Pastille key={code} ton="neutre" compacte>
                          {LIBELLES_GROUPES[code]}
                        </Pastille>
                      ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Carte>
  );
}
