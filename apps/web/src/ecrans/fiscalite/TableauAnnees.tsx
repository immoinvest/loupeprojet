import type { AnneeFiscale } from '@loupe/moteur';
import type { JSX } from 'react';

import { euros, eurosSignes } from '@/formatage/nombres';

const COLONNES: readonly {
  readonly titre: string;
  readonly valeur: (a: AnneeFiscale) => string;
}[] = [
  { titre: 'Recettes', valeur: (a) => euros(a.recettes) },
  { titre: 'Charges déductibles', valeur: (a) => euros(a.chargesDeductibles) },
  { titre: 'Intérêts', valeur: (a) => euros(a.interetsDeductibles) },
  { titre: 'Amortissements déduits', valeur: (a) => euros(a.amortissementsDeduits) },
  {
    titre: 'Déficits imputés',
    valeur: (a) => euros(a.deficitImpute + a.deficitImputeRevenuGlobal),
  },
  { titre: 'Base imposable', valeur: (a) => euros(a.baseImposable) },
  { titre: 'Impôt', valeur: (a) => euros(a.impot) },
  { titre: 'Cash-flow après impôt', valeur: (a) => eurosSignes(a.cashflowApresImpot) },
];

/** Le détail fiscal du régime retenu, année par année. */
export function TableauAnnees({ annees }: { annees: readonly AnneeFiscale[] }): JSX.Element {
  return (
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
          {annees.map((a) => (
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
  );
}
