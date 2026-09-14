import type { AnneeCredit, ResultatFinancement } from '@loupe/moteur';
import type { JSX } from 'react';

import { Carte, TitreCarte } from '@/composants/ui';
import { euros } from '@/formatage/nombres';
import { PHASES, TEXTES_FINANCEMENT as T } from '@/textes/financement';

const COLONNES: readonly { readonly titre: string; readonly valeur: (a: AnneeCredit) => string }[] =
  [
    { titre: 'Mensualités', valeur: (a) => euros(a.mensualites) },
    { titre: 'dont intérêts', valeur: (a) => euros(a.interets) },
    { titre: 'dont capital', valeur: (a) => euros(a.capital) },
    { titre: 'Assurance', valeur: (a) => euros(a.assurance) },
    { titre: 'Restant dû en fin d’année', valeur: (a) => euros(a.crdFin) },
  ];

/** Les phases du prêt quand il y a un différé, puis le tableau d'amortissement par année. */
export function TableauAnnuel({ f }: { f: ResultatFinancement }): JSX.Element {
  return (
    <Carte>
      <TitreCarte>{T.anneeParAnnee}</TitreCarte>
      {f.tableau.length === 0 ? (
        <p className="m-0 text-[15px] text-encre-2">{T.sansEmprunt}</p>
      ) : (
        <>
          {f.echeancier.length > 1 && (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[15px] text-encre-2">
              {f.echeancier.map((e) => (
                <li key={e.phase} className="flex flex-wrap justify-between gap-x-4">
                  <span>
                    {PHASES[e.phase]} · mois {e.deMois} à {e.aMois}
                  </span>
                  <span className="font-semibold whitespace-nowrap">
                    {euros(e.mensualiteTotale)} par mois
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-encre-3">
                  <th className="sticky left-0 bg-surface py-2 pr-3 font-semibold">Année</th>
                  {COLONNES.map((c) => (
                    <th key={c.titre} className="py-2 pr-3 text-right font-semibold">
                      {c.titre}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {f.parAnnee.map((a) => (
                  <tr key={a.annee} className="border-t border-bordure-douce">
                    <td className="sticky left-0 bg-surface py-2 pr-3 font-semibold">{a.annee}</td>
                    {COLONNES.map((c) => (
                      <td key={c.titre} className="py-2 pr-3 text-right">
                        {c.valeur(a)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Carte>
  );
}
